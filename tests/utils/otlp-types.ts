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

import type { Attributes, HrTime } from '@opentelemetry/api'
import { hrTimeDuration } from '@opentelemetry/core'
import type { TimedEvent } from '@opentelemetry/sdk-trace-base'

import type { ExportedTestSpan } from './test-span'

interface OtlpAnyValue {
	arrayValue?: { values: OtlpAnyValue[] }
	boolValue?: boolean
	doubleValue?: number
	intValue?: number
	stringValue?: string
}

interface OtlpKeyValue {
	key: string
	value: OtlpAnyValue
}

interface OtlpEvent {
	attributes?: OtlpKeyValue[]
	name: string
	timeUnixNano: string
}

interface RawOtlpSpan {
	attributes: OtlpKeyValue[]
	endTimeUnixNano: string
	events?: OtlpEvent[]
	kind: number
	name: string
	parentSpanId?: string
	spanId: string
	startTimeUnixNano: string
	status?: { code?: number }
	traceId: string
}

interface OtlpPayload {
	resourceSpans: {
		resource?: { attributes: OtlpKeyValue[] }
		scopeSpans: { spans: RawOtlpSpan[] }[]
	}[]
}

function extractValue(kv: OtlpKeyValue): string | number | boolean | undefined {
	const v = kv.value
	if (v.stringValue !== undefined && v.stringValue !== null) {
		return v.stringValue
	}

	if (v.intValue !== undefined && v.intValue !== null) {
		return v.intValue
	}

	if (v.doubleValue !== undefined && v.doubleValue !== null) {
		return v.doubleValue
	}

	if (v.boolValue !== undefined && v.boolValue !== null) {
		return v.boolValue
	}

	return undefined
}

function kvToAttributes(kvs: OtlpKeyValue[]): Attributes {
	const attrs: Attributes = {}
	for (const kv of kvs) {
		const val = extractValue(kv)
		if (val !== undefined) {
			attrs[kv.key] = val
		}
	}
	return attrs
}

function nanosToHrTime(nanos: string): HrTime {
	const n = BigInt(nanos)
	const seconds = Number(n / 1_000_000_000n)
	const nanosRemainder = Number(n % 1_000_000_000n)
	return [seconds, nanosRemainder]
}

function convertEvent(raw: OtlpEvent): TimedEvent {
	return {
		attributes: raw.attributes ? kvToAttributes(raw.attributes) : {},
		name: raw.name,
		time: nanosToHrTime(raw.timeUnixNano),
	}
}

function convertSpan(raw: RawOtlpSpan, resourceAttrs: OtlpKeyValue[]): ExportedTestSpan {
	const allAttrs = [...resourceAttrs, ...raw.attributes]
	const startTime = nanosToHrTime(raw.startTimeUnixNano)
	const endTime = nanosToHrTime(raw.endTimeUnixNano)

	return {
		attributes: kvToAttributes(allAttrs),
		duration: hrTimeDuration(startTime, endTime),
		endTime,
		events: (raw.events ?? []).map(convertEvent),
		kind: raw.kind,
		name: raw.name,
		parentSpanId: raw.parentSpanId || undefined,
		spanId: raw.spanId,
		startTime,
		status: { code: raw.status?.code ?? 0 },
		traceId: raw.traceId,
	}
}

export function parseOtlpPayload(data: string): ExportedTestSpan[] {
	const payload = JSON.parse(data) as OtlpPayload
	const spans: ExportedTestSpan[] = []
	for (const rs of payload.resourceSpans) {
		const resourceAttrs = rs.resource?.attributes ?? []
		for (const ss of rs.scopeSpans) {
			for (const raw of ss.spans) {
				spans.push(convertSpan(raw, resourceAttrs))
			}
		}
	}
	return spans
}
