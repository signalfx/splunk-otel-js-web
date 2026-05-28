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

import { diag } from '@opentelemetry/api'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'

import { SessionManager } from '../managers'
import { SplunkOtelWebConfig } from '../types'
import { VERSION } from '../version'
import {
	isLongAnimationFrameSupported,
	LOAF_MODULE_NAME,
	LONG_ANIMATION_FRAME_PERFORMANCE_TYPE,
	MAX_LOAF_SPANS_PER_SESSION,
	type PerformanceLongAnimationFrameTimingStable,
	setLoafEntryAttributes,
} from './loaf'
import { LoafSpanRateLimiter } from './loaf/rate-limit'

export {
	getLoafScriptSummaries,
	isLoafInstrumentationEnabled,
	isLongAnimationFrameSupported,
	LONG_ANIMATION_FRAME_PERFORMANCE_TYPE,
	MAX_LOAF_SCRIPT_SUMMARIES,
	MAX_LOAF_SPANS_PER_SESSION,
	normalizeLoafSourceUrl,
} from './loaf'
export type { PerformanceScriptTimingStable } from './loaf'

export class SplunkLongAnimationFrameInstrumentation extends InstrumentationBase {
	private createdSpanCount = 0

	private loafObserver: PerformanceObserver | undefined

	private spanRateLimiter = new LoafSpanRateLimiter()

	constructor(
		config: InstrumentationConfig = {},
		_otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
	) {
		super(LOAF_MODULE_NAME, VERSION, Object.assign({}, config))
	}

	disable(): void {
		this.loafObserver?.disconnect()
		this.loafObserver = undefined
	}

	enable(): void {
		if (!isLongAnimationFrameSupported()) {
			return
		}

		this.loafObserver = new PerformanceObserver((list) => {
			list.getEntries().forEach((entry) =>
				this.createSpanFromEntry(entry as PerformanceLongAnimationFrameTimingStable),
			)
		})

		try {
			this.loafObserver.observe({ buffered: true, type: LONG_ANIMATION_FRAME_PERFORMANCE_TYPE })
		} catch (error) {
			diag.warn('[Splunk]: LoAF instrumentation failed to observe long-animation-frame entries.', { error })
			this.loafObserver.disconnect()
			this.loafObserver = undefined
		}
	}

	init(): void {}

	private createSpanFromEntry(entry: PerformanceLongAnimationFrameTimingStable): void {
		if (this.createdSpanCount >= MAX_LOAF_SPANS_PER_SESSION) {
			return
		}

		if (!this.spanRateLimiter.shouldEmit(entry)) {
			return
		}

		this.createdSpanCount += 1

		const span = this.tracer.startSpan(LONG_ANIMATION_FRAME_PERFORMANCE_TYPE, {
			startTime: entry.startTime,
		})

		setLoafEntryAttributes(span, entry)
		span.end(entry.startTime + entry.duration)
	}
}
