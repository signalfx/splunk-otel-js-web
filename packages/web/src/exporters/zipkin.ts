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

import {
	toZipkinSpan,
	defaultStatusCodeTagName,
	defaultStatusErrorTagName,
} from '@opentelemetry/exporter-zipkin/build/src/transform.js'
import { ExportResult, ExportResultCode } from '@opentelemetry/core'
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import { limitLen } from '../utils'
import {
	NOOP_ATTRIBUTES_TRANSFORMER,
	NATIVE_XHR_SENDER,
	NATIVE_BEACON_SENDER,
	type SplunkExporterConfig,
} from './common'
import { hasToString } from '../types'

const MAX_VALUE_LIMIT = 4096
const SERVICE_NAME = 'browser'

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinAnnotation {
	timestamp: number
	value: string
}

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinEndpoint {
	ipv4?: string
	port?: number
	serviceName?: string
}

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinTags {
	[tagKey: string]: unknown
}

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinSpan {
	annotations?: ZipkinAnnotation[]
	debug?: boolean
	duration: number
	id: string
	kind?: 'CLIENT' | 'SERVER' | 'CONSUMER' | 'PRODUCER'
	localEndpoint?: ZipkinEndpoint
	name: string
	parentId?: string
	shared?: boolean
	tags: ZipkinTags
	timestamp: number
	traceId: string
}

/**
 * SplunkExporter is based on Zipkin V2. It includes Splunk-specific modifications.
 */
export class SplunkZipkinExporter implements SpanExporter {
	// TODO: a test which relies on beaconUrl needs to be fixed first
	public readonly beaconUrl: string

	private readonly _beaconSender: SplunkExporterConfig['beaconSender']

	private readonly _onAttributesSerializing: SplunkExporterConfig['onAttributesSerializing']

	private readonly _xhrSender: SplunkExporterConfig['xhrSender']

	constructor({
		url,
		onAttributesSerializing = NOOP_ATTRIBUTES_TRANSFORMER,
		xhrSender = NATIVE_XHR_SENDER,
		beaconSender = NATIVE_BEACON_SENDER,
	}: SplunkExporterConfig) {
		this.beaconUrl = url
		this._onAttributesSerializing = onAttributesSerializing
		this._xhrSender = xhrSender
		this._beaconSender = beaconSender
	}

	export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
		const zspans = spans.map((span) => this._mapToZipkinSpan(span))
		const zJson = JSON.stringify(zspans)
		if (document.hidden && this._beaconSender && zJson.length <= 64000) {
			this._beaconSender(this.beaconUrl, zJson)
		} else if (this._xhrSender) {
			this._xhrSender(this.beaconUrl, zJson, {
				'Accept': '*/*',
				'Content-Type': 'text/plain;charset=UTF-8',
			})
		}

		resultCallback({ code: ExportResultCode.SUCCESS })
	}

	shutdown(): Promise<void> {
		return Promise.resolve()
	}

	private _mapToZipkinSpan(span: ReadableSpan): ZipkinSpan {
		const preparedSpan = this._preTranslateSpan(span)
		const zspan = toZipkinSpan(preparedSpan, SERVICE_NAME, defaultStatusCodeTagName, defaultStatusErrorTagName)
		return this._postTranslateSpan(zspan)
	}

	private _postTranslateSpan(span: ZipkinSpan) {
		delete span.localEndpoint
		span.name = limitLen(span.name, MAX_VALUE_LIMIT)
		for (const [key, value] of Object.entries(span.tags)) {
			if (hasToString(value)) {
				span.tags[key] = limitLen(value.toString(), MAX_VALUE_LIMIT)
			}
		}
		// Remove inaccurate CORS timings
		const zero = performance.timeOrigin * 1000
		if (
			span.tags['http.url'] &&
			!(span.tags['http.url'] as string).startsWith(location.origin) &&
			span.timestamp > zero &&
			span.annotations
		) {
			span.annotations = span.annotations.filter(
				({ timestamp }) =>
					// Chrome has increased precision on timeOrigin but otel may round it
					// Due to multiple roundings and truncs it can be less than timeOrigin
					timestamp > zero,
			)
		}

		return span
	}

	private _preTranslateSpan(span: ReadableSpan): ReadableSpan {
		return {
			// todo: once typescript is implemented, conform to ReadableSpan
			// note: some properties in Span are not enumerable, and as a result cannot be spread or Object.assign'ed
			name: span.name,
			kind: span.kind,
			spanContext: span.spanContext.bind(span),
			parentSpanId: span.parentSpanId,
			startTime: span.startTime,
			endTime: span.endTime,
			status: span.status,
			links: span.links,
			events: span.events,
			duration: span.duration,
			ended: span.ended,
			instrumentationLibrary: span.instrumentationLibrary,

			resource: span.resource,
			attributes: this._onAttributesSerializing
				? this._onAttributesSerializing(span.attributes, span)
				: span.attributes,

			droppedAttributesCount: span.droppedAttributesCount,
			droppedEventsCount: span.droppedEventsCount,
			droppedLinksCount: span.droppedLinksCount,
		}
	}
}
