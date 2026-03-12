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
import { Root } from 'protobufjs'
import { LogExporter, Log, IAnyValue } from './types'
import type { JsonArray, JsonObject } from 'type-fest'
import { gzipSync, gunzipSync } from 'fflate'
import { apiFetch } from './api/api-fetch'

import * as logsProto from './proto/LogsProto'
import * as proto from './proto/OtelProto'
import { VERSION } from './version'

const defaultHeaders = {
	'Content-Type': 'application/x-protobuf',
	'Content-Encoding': 'gzip',
}

interface OTLPLogExporterConfig {
	beaconUrl: string
	debug?: boolean
	getResourceAttributes: () => JsonObject
	headers?: Record<string, string>
	sessionId: string
	usePersistentExportQueue: boolean
}

function isArray(value: unknown): value is JsonArray {
	return Array.isArray(value)
}

function isObject(value: unknown): value is JsonObject {
	return !!value && typeof value === 'object' && !isArray(value)
}

function isUint8Array(value: unknown): value is Uint8Array {
	return value instanceof Uint8Array
}

function convertToAnyValue(value: unknown): IAnyValue {
	if (isUint8Array(value)) {
		console.log('🔴 dbg: convertToAnyValue Uint8Array', value)

		return {
			bytesValue: value,
		}
	}

	if (isObject(value)) {
		console.log('🔴 dbg: convertToAnyValue object', value)

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

	console.log('🔴 dbg: convertToAnyValue - unknown value', value)

	// never
	return {}
}

export class OTLPProtoLogExporter implements LogExporter {
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
							?.values as JsonArray,
					},
					scopeLogs: [
						{
							scope: { name: 'splunk.rr-web', version: VERSION },
							logRecords: logs.map((log) => ({
								body: convertToAnyValue(log.body) as JsonObject,
								timeUnixNano: log.timeUnixNano,
								attributes: convertToAnyValue(log.attributes || {}).kvlistValue?.values as JsonArray,
							})),
						},
					],
				},
			],
		}
	}

	export(logs: Log[]) {
		if (logs.length === 0) {
			return
		}

		const headers = this.config.headers ? Object.assign({}, defaultHeaders, this.config.headers) : defaultHeaders
		const endpoint = this.config.beaconUrl

		const logsData = this.constructLogData(logs)
		if (this.config.debug) {
			console.log('otlp request', logsData)
		}

		console.log('🥶 dbg: OTLPProtoLogExporter.export', logs)

		const LogsDataProto = (logsProto as unknown as { default: Root }).default.lookupType(
			'opentelemetry.proto.logs.v1.LogsData',
		) as unknown as typeof proto.opentelemetry.proto.logs.v1.LogsData

		const logsProtoData = LogsDataProto.encode(logsData).finish()
		console.log('🧑‍💻 dbg: OTLPProtoLogExporter.export encoded data', logsProtoData)

		const decodedData = LogsDataProto.decode(logsProtoData)
		console.log('🙏 dbg: OTLPProtoLogExporter.export decodedData', decodedData)

		const compressedData = gzipSync(logsProtoData)
		console.log('🔥 dbg: OTLPProtoLogExporter.export gunzip', gunzipSync(compressedData))
		console.log(
			'🥶 dbg: OTLPProtoLogExporter.export gunziped & unmarshalled',
			LogsDataProto.decode(gunzipSync(compressedData)),
		)

		void sendByFetch(endpoint, headers, compressedData, () => {})
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
