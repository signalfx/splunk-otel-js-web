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

import { HrTime, Span } from '@opentelemetry/api'
import { addHrTimes, hrTimeToMilliseconds, millisToHrTime } from '@opentelemetry/core'
import { InstrumentationBase } from '@opentelemetry/instrumentation'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import {
	AttributionReportOpts,
	CLSMetricWithAttribution,
	INPAttributionReportOpts,
	INPMetricWithAttribution,
	LCPMetricWithAttribution,
	onCLS,
	onINP,
	onLCP,
} from 'web-vitals/attribution'

import { SessionManager } from '../managers'
import { SplunkOtelWebConfig } from '../types'
import { VERSION } from '../version'
import {
	generateSafeWebVitalsTarget,
	getLCPUrlForAttribution,
	getResolvedWebVitalsAttributionConfig,
	getWebVitalMetricReportKey,
	setCLSAttributionAttributes,
	setINPAttributionAttributes,
	setLCPAttributionAttributes,
	setNumberAttribute,
	setStringAttribute,
	shouldExportWebVitalsTarget,
	SplunkWebVitalsInstrumentationConfig,
	WebVitalMetricWithAttribution,
	WebVitalName,
	WebVitalsAttributionOptions,
} from './webvitals'

export {
	generateSafeWebVitalsTarget,
	getLCPResourceTimingAttributes,
	getLCPUrlForAttribution,
	getResolvedWebVitalsAttributionConfig,
	getWebVitalMetricReportKey,
	sanitizeLCPUrl,
	shouldExportWebVitalsTarget,
} from './webvitals'
export type {
	SplunkWebVitalsInstrumentationConfig,
	WebVitalsAttributionConfig,
	WebVitalsLCPUrlAttribution,
	WebVitalsTargetAttribution,
} from './webvitals'

const MODULE_NAME = 'splunk-webvitals'

// Upper bound (in milliseconds) on how long `reportMetric` will wait for the
// document load span before falling back to the current wall-clock time.
// Prevents indefinite hangs when the `document` instrumentation is disabled or
// never emits a `documentLoad` event.
const DOC_LOAD_SPAN_WAIT_TIMEOUT_MS = 30_000

export class SplunkWebVitalsInstrumentation extends InstrumentationBase<SplunkWebVitalsInstrumentationConfig> {
	private areCallbackAttached = false

	private docLoadSpanPromise: Promise<ReadableSpan | undefined>

	private docLoadSpanResolve: ((span?: ReadableSpan) => void) | undefined

	private isRecording = false

	private reportedMetricKeys = new Set<string>()

	constructor(
		config: SplunkWebVitalsInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
	) {
		super(MODULE_NAME, VERSION, config)

		this.docLoadSpanPromise = new Promise<ReadableSpan | undefined>((resolve) => {
			this.docLoadSpanResolve = resolve
		})

		// Fall back to wall-clock alignment if `documentLoad` never arrives
		// (e.g. `document` instrumentation is disabled).
		const fallbackTimeout = setTimeout(() => {
			this.docLoadSpanResolve?.()
			this.docLoadSpanResolve = undefined
		}, DOC_LOAD_SPAN_WAIT_TIMEOUT_MS)
		// Allow the host (Node tests, headless environments) to exit even if
		// the timer is still pending. `unref` is unavailable in the browser.
		if (typeof (fallbackTimeout as unknown as { unref?: () => void }).unref === 'function') {
			;(fallbackTimeout as unknown as { unref: () => void }).unref()
		}

		this.otelConfig.spanEmitter?.addEventListener('document-load', (span) => {
			// `document-load` component emits both documentFetch and documentLoad spans.
			// We only want the documentLoad span for alignment.
			if (span.name !== 'documentLoad') {
				return
			}

			clearTimeout(fallbackTimeout)
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
			onCLS((metric) => {
				void this.reportMetric('cls', metric)
			}, this.getAttributionOptions(this._config.cls))
		}

		if (this._config.lcp !== false) {
			onLCP((metric) => {
				void this.reportMetric('lcp', metric)
			}, this.getAttributionOptions(this._config.lcp))
		}

		if (this._config.inp !== false) {
			onINP((metric) => {
				void this.reportMetric('inp', metric)
			}, this.getINPOptions())
		}
	}

	init(): void {}

	private getAttributionContext(): WebVitalsAttributionOptions {
		return {
			getLCPUrl: (url) => getLCPUrlForAttribution(url, this._config.attribution),
			shouldExportTarget: shouldExportWebVitalsTarget(this._config.attribution),
		}
	}

	private getAttributionOptions(config: boolean | AttributionReportOpts | undefined): AttributionReportOpts {
		const options = typeof config === 'object' ? { ...config } : {}
		const targetMode = getResolvedWebVitalsAttributionConfig(this._config.attribution).target
		if (targetMode === 'safe') {
			options.generateTarget = generateSafeWebVitalsTarget
		}

		return options
	}

	private getINPOptions(): INPAttributionReportOpts {
		const options = this.getAttributionOptions(this._config.inp) as INPAttributionReportOpts
		if (typeof this._config.inp === 'object') {
			options.includeProcessedEventEntries = this._config.inp.includeProcessedEventEntries ?? false
			return options
		}

		options.includeProcessedEventEntries = false
		return options
	}

	private async reportMetric(name: WebVitalName, metric: WebVitalMetricWithAttribution): Promise<void> {
		if (!this.isRecording) {
			return
		}

		const value = metric.value
		if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
			return
		}

		const reportKey = getWebVitalMetricReportKey(name, metric)
		if (this.reportedMetricKeys.has(reportKey)) {
			return
		}

		this.reportedMetricKeys.add(reportKey)

		const now = Date.now()
		let endTime: HrTime | number = now
		let span
		const docLoadSpan = this.shouldAlignWithDocumentLoad() ? await this.docLoadSpanPromise : undefined
		if (docLoadSpan) {
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
			const docLoadLocation = docLoadSpan.attributes['location.href']
			if (docLoadLocation) {
				span.setAttribute('location.href', docLoadLocation)
			}
		} else {
			span = this.tracer.startSpan('webvitals', { startTime: now })
		}

		span.setAttribute(name, value)
		setStringAttribute(span, 'webvitals.metric_id', metric.id)
		setNumberAttribute(span, 'webvitals.delta', metric.delta)
		setStringAttribute(span, 'webvitals.navigation_type', metric.navigationType)
		this.setAttributionAttributes(span, name, metric)
		span.end(endTime)
	}

	private setAttributionAttributes(span: Span, name: WebVitalName, metric: WebVitalMetricWithAttribution): void {
		const attributionContext = this.getAttributionContext()

		switch (name) {
			case 'cls': {
				setCLSAttributionAttributes(span, metric as CLSMetricWithAttribution, attributionContext)
				return
			}
			case 'inp': {
				setINPAttributionAttributes(span, metric as INPMetricWithAttribution, attributionContext)
				return
			}
			case 'lcp': {
				setLCPAttributionAttributes(span, metric as LCPMetricWithAttribution, attributionContext)
				return
			}
		}
	}

	private shouldAlignWithDocumentLoad(): boolean {
		return this._config.alignWebVitalsSpansWithDocumentLoad ?? true
	}
}
