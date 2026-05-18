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
	INPAttributionReportOpts,
	onCLS,
	onFCP,
	onINP,
	onLCP,
	onTTFB,
} from 'web-vitals/attribution'

import { SessionManager } from '../managers'
import { isFiniteNumber, SplunkOtelWebConfig } from '../types'
import { VERSION } from '../version'
import {
	generateSafeWebVitalsTarget,
	getLCPUrlForAttribution,
	getResolvedWebVitalsAttributionConfig,
	getWebVitalMetricReportKey,
	getWebVitalsTargetForAttribution,
	setCLSAttributionAttributes,
	setFCPAttributionAttributes,
	setINPAttributionAttributes,
	setLCPAttributionAttributes,
	setNumberAttribute,
	setStringAttribute,
	setTTFBAttributionAttributes,
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

// Allow the host (Node tests, headless environments) to exit even if the
// timer is still pending. `unref` is unavailable in the browser.
function maybeUnref(handle: ReturnType<typeof setTimeout>): void {
	if (typeof (handle as unknown as { unref?: () => void }).unref === 'function') {
		;(handle as unknown as { unref: () => void }).unref()
	}
}

export class SplunkWebVitalsInstrumentation extends InstrumentationBase<SplunkWebVitalsInstrumentationConfig> {
	private areCallbackAttached = false

	private attributionContext: WebVitalsAttributionOptions | undefined

	private docLoadSpanPromise: Promise<ReadableSpan | undefined>

	private docLoadSpanResolve: ((span?: ReadableSpan) => void) | undefined

	private isRecording = false

	private reportedMetricKeys = new Set<string>()

	constructor(
		config: SplunkWebVitalsInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
	) {
		super(MODULE_NAME, VERSION, { ...config, enabled: false })

		this.docLoadSpanPromise = new Promise<ReadableSpan | undefined>((resolve) => {
			this.docLoadSpanResolve = resolve
		})

		// Fall back to wall-clock alignment if `documentLoad` never arrives
		// (e.g. `document` instrumentation is disabled).
		const fallbackTimeout = setTimeout(() => {
			this.docLoadSpanResolve?.()
			this.docLoadSpanResolve = undefined
		}, DOC_LOAD_SPAN_WAIT_TIMEOUT_MS)
		maybeUnref(fallbackTimeout)

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

		this._config.enabled = config.enabled ?? true
		if (this._config.enabled) {
			this.enable()
		}
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
		this.attributionContext = undefined
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

		if (this.isExperimentalMetricEnabled(this._config._experimental_fcp)) {
			onFCP((metric) => {
				void this.reportMetric({ metric, name: 'fcp' })
			}, this.getAttributionOptions(this._config._experimental_fcp))
		}

		if (this.isExperimentalMetricEnabled(this._config._experimental_ttfb)) {
			onTTFB((metric) => {
				void this.reportMetric({ metric, name: 'ttfb' })
			}, this.getAttributionOptions(this._config._experimental_ttfb))
		}
	}

	init(): void {}

	private getAttributionContext(): WebVitalsAttributionOptions {
		if (!this.attributionContext) {
			const resolvedConfig = getResolvedWebVitalsAttributionConfig(this._config.attribution)
			this.attributionContext = {
				getLCPUrl: (url) => getLCPUrlForAttribution(url, resolvedConfig),
				getTarget: (target) => getWebVitalsTargetForAttribution(target, resolvedConfig),
			}
		}

		return this.attributionContext
	}

	private getAttributionOptions(config: boolean | AttributionReportOpts | undefined): AttributionReportOpts {
		const options = typeof config === 'object' ? { ...config } : {}
		if (!this.shouldExportAttribution()) {
			return options
		}

		const { target: targetMode } = getResolvedWebVitalsAttributionConfig(this._config.attribution)
		if (targetMode === 'safe') {
			options.generateTarget = generateSafeWebVitalsTarget
		}

		return options
	}

	private getINPOptions(): INPAttributionReportOpts {
		const base = this.getAttributionOptions(this._config.inp)
		const includeProcessedEventEntries =
			typeof this._config.inp === 'object' ? (this._config.inp.includeProcessedEventEntries ?? false) : false
		return { ...base, includeProcessedEventEntries }
	}

	private isExperimentalMetricEnabled(config: boolean | AttributionReportOpts | undefined): boolean {
		return config !== undefined && config !== false
	}

	private async reportMetric(report: WebVitalReport): Promise<void> {
		if (!this.isRecording) {
			return
		}

		const { metric, name } = report
		const value = metric.value
		if (!isFiniteNumber(value) || value < 0) {
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
		if (this.shouldExportAttribution()) {
			setStringAttribute(span, 'webvitals.metric_id', metric.id)
			setNumberAttribute(span, 'webvitals.delta', metric.delta)
			setStringAttribute(span, 'webvitals.navigation_type', metric.navigationType)
			this.setAttributionAttributes(span, report)
		}

		span.end(endTime)
	}

	private setAttributionAttributes(span: Span, report: WebVitalReport): void {
		const attributionContext = this.getAttributionContext()

		switch (report.name) {
			case 'cls': {
				setCLSAttributionAttributes(span, report.metric, attributionContext)
				return
			}
			case 'fcp': {
				setFCPAttributionAttributes(span, report.metric)
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
			case 'ttfb': {
				setTTFBAttributionAttributes(span, report.metric)
				return
			}
		}
	}

	private shouldAlignWithDocumentLoad(): boolean {
		return this._config.alignWebVitalsSpansWithDocumentLoad ?? true
	}

	private shouldExportAttribution(): boolean {
		return this._config._experimental_attribution === true
	}
}
