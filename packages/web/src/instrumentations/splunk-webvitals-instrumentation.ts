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

import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'
import { Metric, onCLS, onINP, onLCP, ReportOpts } from 'web-vitals'

import { VERSION } from '../version'

const MODULE_NAME = 'splunk-webvitals'

export interface SplunkWebVitalsInstrumentationConfig extends InstrumentationConfig {
	cls?: boolean | ReportOpts
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
					this.reportMetric('cls', metric)
				},
				typeof this._config.cls === 'object' ? this._config.cls : undefined,
			)
		}

		if (this._config.lcp !== false) {
			onLCP(
				(metric) => {
					this.reportMetric('lcp', metric)
				},
				typeof this._config.lcp === 'object' ? this._config.lcp : undefined,
			)
		}

		if (this._config.inp !== false) {
			onINP(
				(metric) => {
					this.reportMetric('inp', metric)
				},
				typeof this._config.inp === 'object' ? this._config.inp : undefined,
			)
		}
	}

	init(): void {}

	private reportMetric(name: string, metric: Metric): void {
		if (!this.isRecording) {
			return
		}

		if (this.reported[name]) {
			return
		}

		this.reported[name] = true

		const value = metric.value
		const now = Date.now()

		const span = this.tracer.startSpan('webvitals', { startTime: now })
		span.setAttribute(name, value)
		span.end(now)
	}
}
