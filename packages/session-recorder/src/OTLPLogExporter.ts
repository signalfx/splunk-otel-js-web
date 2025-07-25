/**
 *
 * Copyright 2020-2025 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { gzipSync, strToU8 } from 'fflate'
import { nanoid } from 'nanoid'
import type { JsonArray, JsonObject, JsonValue } from 'type-fest'

import { IAnyValue, Log } from './types'
import { VERSION } from './version'
import { compressAsync } from './session-replay/utils'
import { apiFetch, ApiParams } from './api/api-fetch'
import { addLogToQueue, removeQueuedLog, QueuedLog, getQueuedLogs, removeAssetsFromQueuedLog } from './export-log-queue'
import { context } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'
import { log } from './log'

interface OTLPLogExporterConfig {
	beaconUrl: string
	getResourceAttributes: () => JsonObject
	headers?: Record<string, string>
	sessionId: string
	usePersistentExportQueue: boolean
}

const KEEPALIVE_MAX_LENGTH = 65536

const defaultHeaders = {
	'Content-Type': 'application/json',
	'Content-Encoding': 'gzip',
}

function isArray(value: JsonValue): value is JsonArray {
	return Array.isArray(value)
}

function isObject(value: JsonValue): value is JsonObject {
	return !!value && typeof value === 'object' && !isArray(value)
}

function convertToAnyValue(value: JsonValue): IAnyValue {
	if (isObject(value)) {
		return {
			kvlistValue: {
				values: Object.entries(value).map(([key, v]) => ({
					key,
					value: convertToAnyValue(v),
				})),
			},
		}
	}

	if (isArray(value)) {
		return {
			arrayValue: {
				values: value.map((v) => convertToAnyValue(v)),
			},
		}
	}

	if (typeof value === 'string') {
		return {
			stringValue: value,
		}
	}

	if (typeof value === 'number') {
		return {
			doubleValue: value,
		}
	}

	if (typeof value === 'boolean') {
		return {
			boolValue: value,
		}
	}

	// never
	return {}
}

export default class OTLPLogExporter {
	config: OTLPLogExporterConfig

	constructor(config: OTLPLogExporterConfig) {
		this.config = config
		this.exportQueuedLogs()
	}

	constructLogData(logs: Log[]) {
		return {
			resourceLogs: [
				{
					resource: {
						attributes: convertToAnyValue(this.config.getResourceAttributes() || {}).kvlistValue
							?.values as JsonArray,
					},
					scopeLogs: [
						{
							scope: { name: 'splunk.rr-web', version: VERSION },
							logRecords: logs.map((logItem) => ({
								// @ts-expect-error FIXME: `body` is not defined
								body: convertToAnyValue(logItem.body) as JsonObject,
								timeUnixNano: logItem.timeUnixNano,
								attributes: convertToAnyValue(logItem.attributes || {}).kvlistValue
									?.values as JsonArray,
							})),
						},
					],
				},
			],
		}
	}

	export(logs: Log[]): void {
		if (logs.length === 0) {
			return
		}

		const headers = this.config.headers ? Object.assign({}, defaultHeaders, this.config.headers) : defaultHeaders

		const logsData = this.constructLogData(logs)
		log.debug('OTLPLogExporter: export', logsData)

		const endpoint = this.config.beaconUrl
		const uint8ArrayData = strToU8(JSON.stringify(logsData))

		const requestId = nanoid()
		const queuedLog: QueuedLog | null = this.config.usePersistentExportQueue
			? {
					data: logsData as unknown as QueuedLog['data'],
					timestamp: Date.now(),
					url: endpoint,
					sessionId: this.config.sessionId,
					headers,
					requestId,
				}
			: null

		if (queuedLog) {
			log.debug('Adding log to queue', { ...queuedLog, data: '[truncated]' })
			const isPersisted = addLogToQueue(queuedLog)
			if (!isPersisted) {
				const { log: queuedLogWithoutImage, stats } = removeAssetsFromQueuedLog(queuedLog, {
					fonts: false,
					images: true,
					css: false,
				})
				const isPersistedWithoutImage = addLogToQueue(queuedLogWithoutImage)
				if (!isPersistedWithoutImage) {
					const { log: queuedLogWithoutAllAssets } = removeAssetsFromQueuedLog(queuedLogWithoutImage, {
						fonts: true,
						images: true,
						css: true,
					})
					const isPersistedWithoutAllAssets = addLogToQueue(queuedLogWithoutAllAssets)
					if (!isPersistedWithoutAllAssets) {
						log.error(
							`Failed to add log to queue after assets removed Total: ${stats?.assets.plain.total}}, CSS: ${stats?.assets.plain.css}, Images: ${stats?.assets.plain.images}, Fonts: ${stats?.assets.plain.fonts}, Other: ${stats?.assets.plain.other}`,
							{
								...queuedLog,
								data: '[truncated]',
							},
						)
					}
				}
			}
		}

		OTLPLogExporter.sendDataToBackend(queuedLog, uint8ArrayData, endpoint, headers)
	}

	exportQueuedLogs(): void {
		let logs: QueuedLog[] = []
		logs = getQueuedLogs() ?? []

		for (const logItem of logs) {
			log.debug('Found queued log', { ...logItem, data: '[truncated]' })

			// Only export logs that belong to the current session
			if (logItem.sessionId !== this.config.sessionId) {
				log.debug(
					'exportQueuedLogs - session mismatch',
					{ ...logItem, data: '[truncated]' },
					{ sessionId: this.config.sessionId },
				)
				continue
			}

			const logData = strToU8(JSON.stringify(logItem.data))

			OTLPLogExporter.sendDataToBackend(logItem, logData, logItem.url, logItem.headers)
		}
	}

	private static sendDataToBackend(
		queuedLog: QueuedLog | null,
		uint8ArrayData: Uint8Array,
		endpoint: string,
		headers: Record<string, string>,
	): void {
		const onFetchSuccess = () => {
			if (!queuedLog) {
				return
			}

			log.debug('Removing queued log', { ...queuedLog, data: '[truncated]' })
			removeQueuedLog(queuedLog)
		}

		if (document.visibilityState === 'hidden') {
			const compressedData = gzipSync(uint8ArrayData)

			// Use fetch with keepalive option instead of beacon.
			// Fetch with keepalive option has limit of 64kB.
			const shouldUseKeepAliveOption = compressedData.byteLength < KEEPALIVE_MAX_LENGTH
			void sendByFetch(
				endpoint,
				{ headers, body: compressedData, keepalive: shouldUseKeepAliveOption },
				onFetchSuccess,
			)
		} else {
			compressAsync(uint8ArrayData)
				.then((compressedData) => {
					void sendByFetch(endpoint, { headers, body: compressedData }, onFetchSuccess)
				})
				.catch((error) => {
					log.error('Could not compress data', error)
				})
		}
	}
}

const sendByFetchInternal = async (
	endpoint: string,
	fetchParams: Pick<ApiParams, 'headers' | 'keepalive' | 'body'>,
	onSuccess: () => void,
) => {
	try {
		await apiFetch(endpoint, {
			method: 'POST',
			abortPreviousRequest: false,
			doNotConvert: true,
			doNotRetryOnDocumentHidden: true,
			retryCount: 100,
			retryOnHttpErrorStatusCodes: true,
			...fetchParams,
		})

		log.debug('Data sent by fetch', { keepalive: fetchParams.keepalive })
		onSuccess()
	} catch (error) {
		log.error('Could not sent data to BE - fetch', error)
	}
}

const sendByFetch = (...args: Parameters<typeof sendByFetchInternal>) =>
	new Promise((resolve, reject) => {
		context.with(suppressTracing(context.active()), () => {
			sendByFetchInternal(...args)
				.then(resolve)
				.catch(reject)
		})
	})
