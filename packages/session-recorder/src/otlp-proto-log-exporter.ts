/**
 *
 * Copyright 2020-2026 Splunk Inc.
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
import { gzipSync } from 'fflate'
import type { JsonArray, JsonObject, JsonValue } from 'type-fest'

import { apiFetch, ApiParams } from './api'
import { log } from './log'
import { compressAsync } from './session-replay/utils'
import { IAnyValue, IKeyValue, Log, LogExporter } from './types'
import { VERSION } from './version'

interface OTLPProtoLogExporterConfig {
	beaconUrl: string
	getResourceAttributes: () => JsonObject
	headers?: Record<string, string>
}

interface LogsData {
	resourceLogs: ResourceLogs[]
}

interface ResourceLogs {
	resource: Resource
	scopeLogs: ScopeLogs[]
}

interface Resource {
	attributes: IKeyValue[]
}

interface ScopeLogs {
	logRecords: LogRecord[]
	scope: InstrumentationScope
}

interface InstrumentationScope {
	name: string
	version: string
}

interface LogRecord {
	attributes: IKeyValue[]
	body: IAnyValue
	timeUnixNano: number
}

const KEEPALIVE_MAX_LENGTH = 65_536
const WIRE_TYPE_VARINT = 0
const WIRE_TYPE_64_BIT = 1
const WIRE_TYPE_LENGTH_DELIMITED = 2

const defaultHeaders = {
	'Content-Encoding': 'gzip',
	'Content-Type': 'application/x-protobuf',
}

const textEncoder = new TextEncoder()

class ProtoWriter {
	private readonly data: number[] = []

	bool(fieldNumber: number, value: boolean): void {
		this.tag(fieldNumber, WIRE_TYPE_VARINT)
		this.uint32(value ? 1 : 0)
	}

	bytes(fieldNumber: number, value: Uint8Array): void {
		this.tag(fieldNumber, WIRE_TYPE_LENGTH_DELIMITED)
		this.uint32(value.byteLength)
		this.raw(value)
	}

	double(fieldNumber: number, value: number): void {
		const buffer = new ArrayBuffer(8)
		new DataView(buffer).setFloat64(0, value, true)

		this.tag(fieldNumber, WIRE_TYPE_64_BIT)
		this.raw(new Uint8Array(buffer))
	}

	finish(): Uint8Array<ArrayBuffer> {
		return new Uint8Array(this.data)
	}

	fixed64(fieldNumber: number, value: number): void {
		const safeValue = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
		const low = safeValue >>> 0
		const high = Math.floor(safeValue / 0x1_00_00_00_00) >>> 0

		this.tag(fieldNumber, WIRE_TYPE_64_BIT)
		this.uint32Byte(low)
		this.uint32Byte(low >>> 8)
		this.uint32Byte(low >>> 16)
		this.uint32Byte(low >>> 24)
		this.uint32Byte(high)
		this.uint32Byte(high >>> 8)
		this.uint32Byte(high >>> 16)
		this.uint32Byte(high >>> 24)
	}

	int64(fieldNumber: number, value: number): void {
		this.tag(fieldNumber, WIRE_TYPE_VARINT)
		this.uint64(value)
	}

	message(fieldNumber: number, write: (writer: ProtoWriter) => void): void {
		const nestedWriter = new ProtoWriter()
		write(nestedWriter)
		this.bytes(fieldNumber, nestedWriter.finish())
	}

	string(fieldNumber: number, value: string): void {
		this.bytes(fieldNumber, textEncoder.encode(value))
	}

	uint32(value: number): void {
		let currentValue = value >>> 0
		while (currentValue > 0x7f) {
			this.data.push((currentValue & 0x7f) | 0x80)
			currentValue >>>= 7
		}
		this.data.push(currentValue)
	}

	private raw(value: Uint8Array): void {
		for (const byte of value) {
			this.data.push(byte)
		}
	}

	private tag(fieldNumber: number, wireType: number): void {
		this.uint32((fieldNumber << 3) | wireType)
	}

	private uint32Byte(value: number): void {
		this.data.push(value & 0xff)
	}

	private uint64(value: number): void {
		let currentValue = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
		while (currentValue > 0x7f) {
			this.data.push((currentValue % 0x80) | 0x80)
			currentValue = Math.floor(currentValue / 0x80)
		}
		this.data.push(currentValue)
	}
}

function isArray(value: JsonValue): value is JsonArray {
	return Array.isArray(value)
}

function isObject(value: JsonValue): value is JsonObject {
	return !!value && typeof value === 'object' && !isArray(value)
}

function convertToAnyValue(value: JsonValue | Uint8Array | undefined): IAnyValue {
	if (value === undefined || value === null) {
		return {}
	}

	if (value instanceof Uint8Array) {
		return {
			bytesValue: value,
		}
	}

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

	return {}
}

function writeLogsData(writer: ProtoWriter, logsData: LogsData): void {
	for (const resourceLog of logsData.resourceLogs) {
		writer.message(1, (resourceLogWriter) => writeResourceLogs(resourceLogWriter, resourceLog))
	}
}

function writeResourceLogs(writer: ProtoWriter, resourceLog: ResourceLogs): void {
	writer.message(1, (resourceWriter) => writeResource(resourceWriter, resourceLog.resource))

	for (const scopeLog of resourceLog.scopeLogs) {
		writer.message(2, (scopeLogWriter) => writeScopeLogs(scopeLogWriter, scopeLog))
	}
}

function writeResource(writer: ProtoWriter, resource: Resource): void {
	for (const attribute of resource.attributes) {
		writer.message(1, (attributeWriter) => writeKeyValue(attributeWriter, attribute))
	}
}

function writeScopeLogs(writer: ProtoWriter, scopeLog: ScopeLogs): void {
	writer.message(1, (scopeWriter) => writeInstrumentationScope(scopeWriter, scopeLog.scope))

	for (const logRecord of scopeLog.logRecords) {
		writer.message(2, (logRecordWriter) => writeLogRecord(logRecordWriter, logRecord))
	}
}

function writeInstrumentationScope(writer: ProtoWriter, scope: InstrumentationScope): void {
	writer.string(1, scope.name)
	writer.string(2, scope.version)
}

function writeLogRecord(writer: ProtoWriter, logRecord: LogRecord): void {
	writer.fixed64(1, logRecord.timeUnixNano)
	writer.message(5, (bodyWriter) => writeAnyValue(bodyWriter, logRecord.body))

	for (const attribute of logRecord.attributes) {
		writer.message(6, (attributeWriter) => writeKeyValue(attributeWriter, attribute))
	}
}

function writeKeyValue(writer: ProtoWriter, keyValue: IKeyValue): void {
	if (keyValue.key !== undefined && keyValue.key !== null) {
		writer.string(1, keyValue.key)
	}

	if (keyValue.value) {
		writer.message(2, (valueWriter) => writeAnyValue(valueWriter, keyValue.value as IAnyValue))
	}
}

function writeAnyValue(writer: ProtoWriter, value: IAnyValue): void {
	if (value.stringValue !== undefined && value.stringValue !== null) {
		writer.string(1, value.stringValue)
		return
	}

	if (value.boolValue !== undefined && value.boolValue !== null) {
		writer.bool(2, value.boolValue)
		return
	}

	if (value.intValue !== undefined && value.intValue !== null) {
		writer.int64(3, value.intValue)
		return
	}

	if (value.doubleValue !== undefined && value.doubleValue !== null) {
		writer.double(4, value.doubleValue)
		return
	}

	if (value.arrayValue) {
		writer.message(5, (arrayWriter) => writeArrayValue(arrayWriter, value.arrayValue?.values ?? []))
		return
	}

	if (value.kvlistValue) {
		writer.message(6, (keyValueListWriter) =>
			writeKeyValueList(keyValueListWriter, value.kvlistValue?.values ?? []),
		)
		return
	}

	if (value.bytesValue) {
		writer.bytes(7, value.bytesValue)
	}
}

function writeArrayValue(writer: ProtoWriter, values: IAnyValue[]): void {
	for (const value of values) {
		writer.message(1, (valueWriter) => writeAnyValue(valueWriter, value))
	}
}

function writeKeyValueList(writer: ProtoWriter, values: IKeyValue[]): void {
	for (const value of values) {
		writer.message(1, (valueWriter) => writeKeyValue(valueWriter, value))
	}
}

const onFetchError = (error: unknown) => {
	log.error('Could not send protobuf data to BE - fetch', error)
}

export class OTLPProtoLogExporter implements LogExporter {
	private readonly config: OTLPProtoLogExporterConfig

	constructor(config: OTLPProtoLogExporterConfig) {
		this.config = config
	}

	constructLogData(logs: Log[]): LogsData {
		return {
			resourceLogs: [
				{
					resource: {
						attributes: convertToAnyValue(this.config.getResourceAttributes()).kvlistValue?.values ?? [],
					},
					scopeLogs: [
						{
							logRecords: logs.map((logItem) => ({
								attributes: convertToAnyValue(logItem.attributes || {}).kvlistValue?.values ?? [],
								body: convertToAnyValue(logItem.body),
								timeUnixNano: logItem.timeUnixNano,
							})),
							scope: { name: 'splunk.rr-web', version: VERSION },
						},
					],
				},
			],
		}
	}

	export(logs: Log[], onSuccess?: () => void): void {
		if (logs.length === 0) {
			return
		}

		const headers = this.config.headers ? Object.assign({}, defaultHeaders, this.config.headers) : defaultHeaders
		const logsData = this.constructLogData(logs)
		log.debug('OTLPProtoLogExporter: export', logsData)

		const writer = new ProtoWriter()
		writeLogsData(writer, logsData)

		OTLPProtoLogExporter.sendDataToBackend(writer.finish(), this.config.beaconUrl, headers, onSuccess)
	}

	private static sendDataToBackend(
		uint8ArrayData: Uint8Array<ArrayBuffer>,
		endpoint: string,
		headers: Record<string, string>,
		onExportSuccess?: () => void,
	): void {
		const onFetchSuccess = () => {
			onExportSuccess?.()
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
					log.error('Could not compress protobuf data', error)
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

		log.debug('Protobuf data sent by fetch', { keepalive: fetchParams.keepalive })
		onSuccess()
	} catch (error) {
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
