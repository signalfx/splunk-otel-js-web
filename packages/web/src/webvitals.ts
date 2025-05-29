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

import { TracerProvider, Tracer } from '@opentelemetry/api'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TS1479 in commonjs
import { onCLS, onLCP, onFID, onINP, Metric, ReportOpts } from 'web-vitals'
const reported: Record<string, boolean> = {}

export interface WebVitalsInstrumentationConfig {
	cls?: boolean | ReportOpts
	fid?: boolean | ReportOpts
	inp?: boolean | ReportOpts
	lcp?: boolean | ReportOpts
}

function report(tracer: Tracer, name: string, metric: Metric): void {
	if (reported[name]) {
		return
	}

	reported[name] = true

	const value = metric.value
	const now = Date.now()

	const span = tracer.startSpan('webvitals', { startTime: now })
	span.setAttribute(name, value)
	span.end(now)
}

export function initWebVitals(provider: TracerProvider, config: WebVitalsInstrumentationConfig = {}): void {
	const tracer = provider.getTracer('webvitals')
	// CLS is defined as being sent more than once, easier to just ensure that everything is sent just on the first occurence.

	if (config.fid !== false) {
		onFID(
			(metric) => {
				report(tracer, 'fid', metric)
			},
			typeof config.fid === 'object' ? config.fid : undefined,
		)
	}

	if (config.cls !== false) {
		onCLS(
			(metric) => {
				report(tracer, 'cls', metric)
			},
			typeof config.cls === 'object' ? config.cls : undefined,
		)
	}

	if (config.lcp !== false) {
		onLCP(
			(metric) => {
				report(tracer, 'lcp', metric)
			},
			typeof config.lcp === 'object' ? config.lcp : undefined,
		)
	}

	if (config.inp !== false) {
		onINP(
			(metric) => {
				report(tracer, 'inp', metric)
			},
			typeof config.inp === 'object' ? config.inp : undefined,
		)
	}
}
