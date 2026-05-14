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
import { AttributionReportOpts, INPAttributionReportOpts, onCLS, onINP, onLCP } from 'web-vitals/attribution'

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
	WebVitalReport,
	WebVitalsAttributionOptions,
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
// `documentLoad` is emitted on the page `load` event; 5 s is a generous upper
// bound that avoids hangs when the `document` instrumentation is disabled.
const DOC_LOAD_SPAN_WAIT_TIMEOUT_MS = 5000

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

	/**
	 * Pauses span emission. Web-vitals callbacks remain attached (the library
	 * provides no off-switch); metrics delivered while disabled are silently
	 * dropped and will not be re-reported when the instrumentation is re-enabled.
	 */
	disable(): void {
		this.isRecording = false
	}

	enable(): void {
		this.isRecording = true
		// Clear stale dedup keys on every enable so that metrics re-delivered
		// after a disable/enable cycle are not silently dropped.
		this.reportedMetricKeys.clear()
		if (this.areCallbackAttached) {
			return
		}

		this.areCallbackAttached = true

		if (this._config.cls !== false) {
			onCLS((metric) => {
				void this.reportMetric({ metric, name: 'cls' })
			}, this.getAttributionOptions(this._config.cls))
		}

		if (this._config.lcp !== false) {
			onLCP((metric) => {
				void this.reportMetric({ metric, name: 'lcp' })
			}, this.getAttributionOptions(this._config.lcp))
		}

		if (this._config.inp !== false) {
			onINP((metric) => {
				void this.reportMetric({ metric, name: 'inp' })
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
		const userValue =
			typeof this._config.inp === 'object' ? this._config.inp.includeProcessedEventEntries : undefined
		options.includeProcessedEventEntries = userValue ?? false
		return options
	}

	private async reportMetric(report: WebVitalReport): Promise<void> {
		if (!this.isRecording) {
			return
		}

		const { metric, name } = report
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
		this.setAttributionAttributes(span, report)
		span.end(endTime)
	}

	private setAttributionAttributes(span: Span, report: WebVitalReport): void {
		const attributionContext = this.getAttributionContext()

		switch (report.name) {
			case 'cls': {
				setCLSAttributionAttributes(span, report.metric, attributionContext)
				return
			}
			case 'inp': {
				setINPAttributionAttributes(span, report.metric, attributionContext)
				return
			}
			case 'lcp': {
				setLCPAttributionAttributes(span, report.metric, attributionContext)
				return
			}
		}
	}

	private shouldAlignWithDocumentLoad(): boolean {
		return this._config.alignWebVitalsSpansWithDocumentLoad ?? true
	}
}
