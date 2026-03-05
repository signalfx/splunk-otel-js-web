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

import { HrTime } from '@opentelemetry/api'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'
import { Metric, onCLS, onINP, onLCP, ReportOpts } from 'web-vitals'

import { VERSION } from '../version'
import { SplunkDocumentLoadInstrumentation } from './splunk-document-load-instrumentation'

const MODULE_NAME = 'splunk-webvitals'

export interface SplunkWebVitalsInstrumentationConfig extends InstrumentationConfig {
	cls?: boolean | ReportOpts
	docLoadInstrumentation?: SplunkDocumentLoadInstrumentation
	/**
	 * If true, the webvitals spans will have their start time aligned with the document load span,
	 * and will inherit the URL attributes from the document load span if available.
	 */
	experimental_alignWebVitalsSpansWithDocumentLoad?: boolean
	inp?: boolean | ReportOpts
	lcp?: boolean | ReportOpts
}

export class SplunkWebVitalsInstrumentation extends InstrumentationBase<SplunkWebVitalsInstrumentationConfig> {
	private areCallbackAttached = false

	private isRecording = false

	private reported: Record<string, boolean> = {}

	constructor(config: SplunkWebVitalsInstrumentationConfig = {}) {
		super(MODULE_NAME, VERSION, config)
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
	}

	init(): void {}

	private async reportMetric(name: string, metric: Metric): Promise<void> {
		if (!this.isRecording) {
			return
		}

		if (this.reported[name]) {
			return
		}

		this.reported[name] = true

		const docLoadPromise = this._config.docLoadInstrumentation?.getDocLoadSpan()

		const value = metric.value
		const now = Date.now()
		let endTime: HrTime | number = now
		let span
		if (this._config.experimental_alignWebVitalsSpansWithDocumentLoad) {
			const docLoadSpan = await docLoadPromise
			let startTime = docLoadSpan?.startTime
			if (startTime && endTime) {
				startTime = [startTime[0] + 1, startTime[1]]
			}

			span = this.tracer.startSpan('webvitals', { startTime: startTime ?? now })
			endTime = docLoadSpan?.startTime ?? now
			const docLoadLocation = docLoadSpan?.attributes['location.href']
			if (docLoadLocation) {
				span.setAttribute('location.href', docLoadLocation)
			}
		} else {
			span = this.tracer.startSpan('webvitals', { startTime: now })
		}

		span.setAttribute(name, value)
		span.end(endTime)
	}
}
