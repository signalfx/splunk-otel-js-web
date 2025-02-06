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
import { VERSION } from './version.js'
import { compressAsync } from './session-replay/utils'
import { apiFetch } from './api/api-fetch'
import { addLogToQueue, removeQueuedLog, QueuedLog, getQueuedLogs, removeQueuedLogs } from './export-log-queue'

interface OTLPLogExporterConfig {
	beaconUrl: string
	debug?: boolean
	getResourceAttributes: () => JsonObject
	headers?: Record<string, string>
	sessionId: string
	usePersistentExportQueue: boolean
}

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

	constructLogData(logs: Log[]): JsonObject {
		return {
			resourceLogs: [
				{
					resource: {
						attributes: convertToAnyValue(this.config.getResourceAttributes() || {}).kvlistValue
							.values as JsonArray,
					},
					scopeLogs: [
						{
							scope: { name: 'splunk.rr-web', version: VERSION },
							logRecords: logs.map((log) => ({
								body: convertToAnyValue(log.body) as JsonObject,
								timeUnixNano: log.timeUnixNano,
								attributes: convertToAnyValue(log.attributes || {}).kvlistValue.values as JsonArray,
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
		if (this.config.debug) {
			console.log('otlp request', logsData)
		}

		const endpoint = this.config.beaconUrl
		const uint8ArrayData = strToU8(JSON.stringify(logsData))

		const requestId = nanoid()
		const queuedLog: QueuedLog | null = this.config.usePersistentExportQueue
			? {
					data: uint8ArrayData,
					timestamp: Date.now(),
					url: endpoint,
					sessionId: this.config.sessionId,
					headers,
					requestId,
				}
			: null

		if (queuedLog) {
			console.log('Adding log to queue', { ...queuedLog, data: '[truncated]' })
			addLogToQueue(queuedLog)
		}

		const onFetchSuccess = () => {
			if (!queuedLog) {
				return
			}

			console.log('Removing queued log', { ...queuedLog, data: '[truncated]' })
			removeQueuedLog(queuedLog)
		}

		if (document.visibilityState === 'hidden') {
			const compressedData = gzipSync(uint8ArrayData)
			console.debug('🗜️ dbg: SYNC compress', { endpoint, headers, compressedData })

			// Use fetch with keepalive option instead of beacon
			void sendByFetch(endpoint, headers, compressedData, onFetchSuccess, true)
		} else {
			compressAsync(uint8ArrayData)
				.then((compressedData) => {
					console.debug('🗜️ dbg: ASYNC compress', { endpoint, headers, compressedData })
					void sendByFetch(endpoint, headers, compressedData, onFetchSuccess)
				})
				.catch((error) => {
					console.error('Could not compress data', error)
				})
		}
	}

	exportQueuedLogs(): void {
		let logs: QueuedLog[] = []
		try {
			logs = getQueuedLogs() ?? []
		} finally {
			removeQueuedLogs()
		}

		for (const log of logs) {
			console.log('Found queued log', { ...log, data: '[truncated]' })

			// Only export logs that belong to the current session
			if (log.sessionId !== this.config.sessionId) {
				console.debug(
					'exportQueuedLogs - session mismatch',
					{ ...log, data: '[truncated]' },
					{ sessionId: this.config.sessionId },
				)
				continue
			}

			compressAsync(log.data)
				.then((compressedData) => {
					void sendByFetch(log.url, log.headers, compressedData, () => {
						console.log('exportQueuedLogs - success', { ...log, data: '[truncated]' })
					})
				})
				.catch((error) => {
					console.error('Could not compress data', error)
				})
		}
	}
}

const sendByFetch = async (
	endpoint: string,
	headers: HeadersInit,
	data: BodyInit,
	onSuccess: () => void,
	keepalive?: boolean,
) => {
	try {
		await apiFetch(endpoint, {
			method: 'POST',
			headers,
			keepalive,
			body: data,
			abortPreviousRequest: false,
			doNotConvert: true,
			doNotRetryOnDocumentHidden: true,
			retryCount: 100,
			retryOnHttpErrorStatusCodes: true,
		})

		console.debug('📦 dbg: sendByFetch', { keepalive })
		onSuccess()
	} catch (error) {
		console.error('Could not sent data to BE - fetch', error)
	}
}
