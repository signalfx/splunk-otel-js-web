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

import { context } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'
import { gzipSync, strToU8 } from 'fflate'
import { nanoid } from 'nanoid'
import type { JsonArray, JsonObject, JsonValue } from 'type-fest'

import { ApiError, apiFetch, ApiParams } from './api'
import { addLogToQueue, getQueuedLogs, QueuedLog, removeQueuedLog, removeQueuedLogs } from './export-log-queue'
import { log } from './log'
import { compressAsync } from './session-replay/utils'
import { IAnyValue, Log } from './types'
import { VERSION } from './version'

interface OTLPLogExporterConfig {
	beaconUrl: string
	getResourceAttributes: () => JsonObject
	headers?: Record<string, string>
	sessionId: string
	usePersistentExportQueue: boolean
}

const KEEPALIVE_MAX_LENGTH = 65_536

const defaultHeaders = {
	'Content-Encoding': 'gzip',
	'Content-Type': 'application/json',
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
							logRecords: logs.map((logItem) => ({
								attributes: convertToAnyValue(logItem.attributes || {}).kvlistValue
									?.values as JsonArray,
								// @ts-expect-error FIXME: `body` is not defined
								body: convertToAnyValue(logItem.body) as JsonObject,
								timeUnixNano: logItem.timeUnixNano,
							})),
							scope: { name: 'splunk.rr-web', version: VERSION },
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
		// TODO: https://github.com/101arrowz/fflate/issues/242
		const uint8ArrayData = strToU8(JSON.stringify(logsData)) as Uint8Array<ArrayBuffer>

		const requestId = nanoid()
		const queuedLog: QueuedLog | null = this.config.usePersistentExportQueue
			? {
					data: logsData as unknown as QueuedLog['data'],
					headers,
					requestId,
					sessionId: this.config.sessionId,
					timestamp: Date.now(),
					url: endpoint,
				}
			: null

		if (queuedLog) {
			log.debug('Adding log to queue', { ...queuedLog, data: '[truncated]' })
			const isPersisted = addLogToQueue(queuedLog)
			if (!isPersisted) {
				log.debug('Failed to add log to queue', { ...queuedLog, data: '[truncated]' })
			}
		}

		OTLPLogExporter.sendDataToBackend(queuedLog, uint8ArrayData, endpoint, headers)
	}

	exportQueuedLogs(): void {
		let logs: QueuedLog[] = []
		logs = getQueuedLogs() ?? []

		// Remove all logs and add only ones that are relevant before sending
		removeQueuedLogs()

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

			// Add log to queue and remove after it has been successfully sent
			addLogToQueue(logItem)

			// TODO: https://github.com/101arrowz/fflate/issues/242
			const logData = strToU8(JSON.stringify(logItem.data)) as Uint8Array<ArrayBuffer>
			OTLPLogExporter.sendDataToBackend(logItem, logData, logItem.url, logItem.headers)
		}
	}

	private static sendDataToBackend(
		queuedLog: QueuedLog | null,
		uint8ArrayData: Uint8Array<ArrayBuffer>,
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

		const onFetchError = (error: unknown) => {
			if (!queuedLog) {
				return
			}

			if (error instanceof ApiError && error.status >= 300) {
				log.debug(`Removing queued log. Request failed with status code ${error.status}`, {
					...queuedLog,
					data: '[truncated]',
				})
				removeQueuedLog(queuedLog)
			}
		}

		if (document.visibilityState === 'hidden') {
			// TODO: https://github.com/101arrowz/fflate/issues/242
			const compressedData = gzipSync(uint8ArrayData) as Uint8Array<ArrayBuffer>

			// Use fetch with keepalive option instead of beacon.
			// Fetch with keepalive option has limit of 64kB.
			const shouldUseKeepAliveOption = compressedData.byteLength < KEEPALIVE_MAX_LENGTH
			void sendByFetch(
				endpoint,
				{ body: compressedData, headers, keepalive: shouldUseKeepAliveOption },
				onFetchSuccess,
				onFetchError,
			)
		} else {
			compressAsync(uint8ArrayData)
				.then((compressedData) => {
					void sendByFetch(endpoint, { body: compressedData, headers }, onFetchSuccess, onFetchError)
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
	onError: (error: unknown) => void,
) => {
	try {
		await apiFetch(endpoint, {
			abortPreviousRequest: false,
			doNotConvert: true,
			doNotRetryOnDocumentHidden: true,
			method: 'POST',
			retryCount: 5,
			...fetchParams,
		})

		log.debug('Data sent by fetch', { keepalive: fetchParams.keepalive })
		onSuccess()
	} catch (error) {
		log.error('Could not sent data to BE - fetch', error)
		onError(error)
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
