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

import { Attributes, HrTime } from '@opentelemetry/api'
import { addHrTimes, hrTimeToMilliseconds, millisToHrTime } from '@opentelemetry/core'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import {
	CLSMetricWithAttribution,
	FCPMetricWithAttribution,
	INPMetricWithAttribution,
	LCPMetricWithAttribution,
	Metric,
	MetricWithAttribution,
	onCLS,
	onFCP,
	onINP,
	onLCP,
	onTTFB,
	ReportOpts,
	TTFBMetricWithAttribution,
} from 'web-vitals/attribution'

import { SessionManager } from '../managers'
import { SplunkOtelWebConfig } from '../types'
import { VERSION } from '../version'

const MODULE_NAME = 'splunk-webvitals'

export interface SplunkWebVitalsInstrumentationConfig extends InstrumentationConfig {
	/**
	 * Experimental: when enabled, web vitals spans gain attribution attributes
	 * describing the cause of the metric value (e.g., target element selector
	 * for LCP/CLS, timing breakdowns for INP) plus common `webvitals.*` attributes
	 * (name, rating, navigation type) on every web vitals span.
	 *
	 * Expected to become the default in a future minor release; the option
	 * will then be deprecated.
	 *
	 * @default false
	 * @experimental
	 */
	_experimental_attribution?: boolean
	/**
	 * Experimental: when set, First Contentful Paint (FCP) is reported as a
	 * `webvitals` span. Pass `true` (or a `ReportOpts` object) to enable.
	 *
	 * Expected to become the default in a future minor release; the option
	 * will then be renamed to `fcp` (mirroring the `cls`/`inp`/`lcp` shape).
	 *
	 * @default false
	 * @experimental
	 */
	_experimental_fcp?: boolean | ReportOpts
	/**
	 * Experimental: when set, Time to First Byte (TTFB) is reported as a
	 * `webvitals` span. Pass `true` (or a `ReportOpts` object) to enable.
	 *
	 * Expected to become the default in a future minor release; the option
	 * will then be renamed to `ttfb` (mirroring the `cls`/`inp`/`lcp` shape).
	 *
	 * @default false
	 * @experimental
	 */
	_experimental_ttfb?: boolean | ReportOpts
	/**
	 * If true, the webvitals spans will have their start time aligned with the document load span,
	 * and will inherit the URL attributes from the document load span if available.
	 * @default true
	 */
	alignWebVitalsSpansWithDocumentLoad?: boolean
	cls?: boolean | ReportOpts
	inp?: boolean | ReportOpts
	lcp?: boolean | ReportOpts
}

export class SplunkWebVitalsInstrumentation extends InstrumentationBase<SplunkWebVitalsInstrumentationConfig> {
	private areCallbackAttached = false

	private docLoadSpanPromise: Promise<ReadableSpan>

	private docLoadSpanResolve: ((span: ReadableSpan) => void) | undefined

	private isRecording = false

	private reported: Record<string, boolean> = {}

	constructor(
		config: SplunkWebVitalsInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
	) {
		super(MODULE_NAME, VERSION, config)

		this.docLoadSpanPromise = new Promise<ReadableSpan>((resolve) => {
			this.docLoadSpanResolve = resolve
		})

		this.otelConfig.spanEmitter?.addEventListener('document-load', (span) => {
			// `document-load` component emits both documentFetch and documentLoad spans.
			// We only want the documentLoad span for alignment.
			if (span.name !== 'documentLoad') {
				return
			}

			this.docLoadSpanResolve?.(span)
			this.docLoadSpanResolve = undefined
		})
	}

	disable(): void {
		this.isRecording = false
	}

	enable(): void {
		this.isRecording = true
		if (this.areCallbackAttached) {
			return
		}

		this.areCallbackAttached = true

		if (this._config.cls !== false) {
			onCLS(
				(metric) => {
					void this.reportMetric('cls', metric)
				},
				typeof this._config.cls === 'object' ? this._config.cls : undefined,
			)
		}

		if (this._config.lcp !== false) {
			onLCP(
				(metric) => {
					void this.reportMetric('lcp', metric)
				},
				typeof this._config.lcp === 'object' ? this._config.lcp : undefined,
			)
		}

		if (this._config.inp !== false) {
			onINP(
				(metric) => {
					void this.reportMetric('inp', metric)
				},
				typeof this._config.inp === 'object' ? this._config.inp : undefined,
			)
		}

		if (this._config._experimental_fcp) {
			onFCP(
				(metric) => {
					void this.reportMetric('fcp', metric)
				},
				typeof this._config._experimental_fcp === 'object' ? this._config._experimental_fcp : undefined,
			)
		}

		if (this._config._experimental_ttfb) {
			onTTFB(
				(metric) => {
					void this.reportMetric('ttfb', metric)
				},
				typeof this._config._experimental_ttfb === 'object' ? this._config._experimental_ttfb : undefined,
			)
		}
	}

	init(): void {}

	private async reportMetric(name: string, metric: MetricWithAttribution): Promise<void> {
		if (!this.isRecording) {
			return
		}

		if (this.reported[name]) {
			return
		}

		this.reported[name] = true

		const value = metric.value
		if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
			return
		}

		const now = Date.now()
		let endTime: HrTime | number = now
		let span
		if (this.shouldAlignWithDocumentLoad()) {
			const docLoadSpan = await this.docLoadSpanPromise
			const alignedStartTime = addHrTimes(docLoadSpan.startTime, millisToHrTime(1))
			let startTime: HrTime | number = alignedStartTime
			endTime = startTime
			const sessionState = this.sessionManager?.getSessionMetadata()
			if (sessionState && sessionState.sessionStart - hrTimeToMilliseconds(alignedStartTime) > 1000 * 60) {
				// If the document load started more than 1 minute before the current session began,
				// it likely belongs to a previous session. In that case, align the span to the
				// current session's start time. The 1-minute tolerance accounts for the fact that
				// the document load timestamp is based on the performance timeline origin,
				// which can precede the session start.
				startTime = sessionState.sessionStart
				endTime = sessionState.sessionStart
			}

			span = this.tracer.startSpan('webvitals', { startTime })
			const docLoadLocation = docLoadSpan?.attributes['location.href']
			if (docLoadLocation) {
				span.setAttribute('location.href', docLoadLocation)
			}
		} else {
			span = this.tracer.startSpan('webvitals', { startTime: now })
		}

		span.setAttribute(name, value)
		if (this._config._experimental_attribution) {
			span.setAttributes(buildCommonAttributes(metric))
			span.setAttributes(buildAttributionAttributes(name, metric))
		}

		span.end(endTime)
	}

	private shouldAlignWithDocumentLoad(): boolean {
		return this._config.alignWebVitalsSpansWithDocumentLoad ?? true
	}
}

function buildCommonAttributes(metric: Metric): Attributes {
	return {
		'webvitals.name': metric.name,
		'webvitals.navigation_type': metric.navigationType,
		'webvitals.rating': metric.rating,
	}
}

function buildAttributionAttributes(name: string, metric: MetricWithAttribution): Attributes {
	switch (name) {
		case 'lcp': {
			return buildLcpAttributes(metric as LCPMetricWithAttribution)
		}
		case 'cls': {
			return buildClsAttributes(metric as CLSMetricWithAttribution)
		}
		case 'inp': {
			return buildInpAttributes(metric as INPMetricWithAttribution)
		}
		case 'fcp': {
			return buildFcpAttributes(metric as FCPMetricWithAttribution)
		}
		case 'ttfb': {
			return buildTtfbAttributes(metric as TTFBMetricWithAttribution)
		}
		default: {
			return {}
		}
	}
}

function buildLcpAttributes(metric: LCPMetricWithAttribution): Attributes {
	const a = metric.attribution
	return {
		'lcp.element_render_delay': a.elementRenderDelay,
		'lcp.resource_load_delay': a.resourceLoadDelay,
		'lcp.resource_load_duration': a.resourceLoadDuration,
		'lcp.target': a.target ?? '',
		'lcp.time_to_first_byte': a.timeToFirstByte,
		'lcp.url': a.url ?? '',
	}
}

function buildClsAttributes(metric: CLSMetricWithAttribution): Attributes {
	const a = metric.attribution
	return {
		'cls.largest_shift_target': a.largestShiftTarget ?? '',
		'cls.largest_shift_time': a.largestShiftTime ?? 0,
		'cls.largest_shift_value': a.largestShiftValue ?? 0,
		'cls.load_state': a.loadState ?? '',
	}
}

function buildInpAttributes(metric: INPMetricWithAttribution): Attributes {
	const a = metric.attribution
	return {
		'inp.input_delay': a.inputDelay,
		'inp.interaction_target': a.interactionTarget ?? '',
		'inp.interaction_type': a.interactionType ?? '',
		'inp.load_state': a.loadState ?? '',
		'inp.presentation_delay': a.presentationDelay,
		'inp.processing_duration': a.processingDuration,
	}
}

function buildFcpAttributes(metric: FCPMetricWithAttribution): Attributes {
	const a = metric.attribution
	return {
		'fcp.first_byte_to_fcp': a.firstByteToFCP,
		'fcp.load_state': a.loadState ?? '',
		'fcp.time_to_first_byte': a.timeToFirstByte,
	}
}

function buildTtfbAttributes(metric: TTFBMetricWithAttribution): Attributes {
	const a = metric.attribution
	return {
		'ttfb.cache_duration': a.cacheDuration,
		'ttfb.connection_duration': a.connectionDuration,
		'ttfb.dns_duration': a.dnsDuration,
		'ttfb.request_duration': a.requestDuration,
		'ttfb.waiting_duration': a.waitingDuration,
	}
}
