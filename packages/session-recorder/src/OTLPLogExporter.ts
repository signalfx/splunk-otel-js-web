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

import { gzipSync, gzip, strToU8 } from 'fflate'
import type { JsonArray, JsonObject, JsonValue } from 'type-fest'

import { IAnyValue, Log } from './types'
import { VERSION } from './version.js'
import { getSessionReplayGlobal } from './session-replay/utils'
import { apiFetch } from './api/api-fetch'

interface OTLPLogExporterConfig {
	beaconUrl: string
	debug?: boolean
	getResourceAttributes: () => JsonObject
	headers?: Record<string, string>
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

		if (document.visibilityState === 'hidden') {
			const compressedData = gzipSync(uint8ArrayData)
			console.debug('🗜️ dbg: SYNC compress', { endpoint, headers, compressedData })

			// Use fetch with keepalive option instead of beacon
			void sendByFetch(endpoint, headers, compressedData, true)
		} else {
			compressAsync(uint8ArrayData)
				.then((compressedData) => {
					console.debug('🗜️ dbg: ASYNC compress', { endpoint, headers, compressedData })
					void sendByFetch(endpoint, headers, compressedData)
				})
				.catch((error) => {
					console.error('Could not compress data', error)
				})
		}
	}
}

const compressAsync = async (data: Uint8Array): Promise<Uint8Array | Blob> => {
	const SessionReplay = getSessionReplayGlobal()
	if (!SessionReplay) {
		console.warn('SessionReplay module undefined, fallback to gzip.')
		return compressGzipAsync(data)
	}

	const isCompressionSupported = await SessionReplay.isCompressionSupported()
	if (!isCompressionSupported) {
		console.warn('Compression is not supported, fallback to gzip.')
		return compressGzipAsync(data)
	}

	const dataBlob = new Blob([data])
	return SessionReplay.compressData(dataBlob.stream(), 'gzip')
}

const compressGzipAsync = async (data: Uint8Array): Promise<Uint8Array> =>
	new Promise<Uint8Array>((resolve, reject) => {
		gzip(data, (err, compressedData) => {
			if (err) {
				reject(err)
				return
			}

			resolve(compressedData)
		})
	})

const sendByFetch = async (endpoint: string, headers: HeadersInit, data: BodyInit, keepalive?: boolean) => {
	try {
		const { response } = await apiFetch(endpoint, {
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

		console.debug('📦 dbg: sendByFetch', { ok: response.ok, keepalive })

		if (!response.ok) {
			console.error('Could not sent data to BE - fetch', data, response)
		}
	} catch (error) {
		console.error('Could not sent data to BE - fetch', error)
	}
}
