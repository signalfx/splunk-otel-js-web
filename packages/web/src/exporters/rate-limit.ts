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

import { Context } from '@opentelemetry/api'

import { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base'

const SPAN_RATE_LIMIT_PERIOD = 30000 // millis, sweep to clear out span counts
const MAX_SPANS_PER_PERIOD_PER_COMPONENT = 100

export class RateLimitProcessor implements SpanProcessor {
	protected readonly _limiterHandle: number

	protected readonly _parents = new Map<string, boolean>()

	protected readonly _spanCounts = new Map<string, number>()

	constructor(protected _processor: SpanProcessor) {
		this._limiterHandle = window.setInterval(() => {
			this._spanCounts.clear()
		}, SPAN_RATE_LIMIT_PERIOD)
	}

	forceFlush(): Promise<void> {
		return this._processor.forceFlush()
	}

	onEnd(span: ReadableSpan): void {
		if (this._filter(span)) {
			this._processor.onEnd(span)
		}
	}

	onStart(span: Span, parentContext: Context): void {
		return this._processor.onStart(span, parentContext)
	}

	shutdown(): Promise<void> {
		clearInterval(this._limiterHandle)
		return this._processor.shutdown()
	}

	protected _filter(span: ReadableSpan): boolean {
		if (span.parentSpanId) {
			this._parents.set(span.parentSpanId, true)
		}

		const component = (span.attributes?.component ?? 'unknown').toString()
		if (!this._spanCounts.has(component)) {
			this._spanCounts.set(component, 0)
		}

		const counter = (this._spanCounts.get(component) || 0) + 1
		this._spanCounts.set(component, counter)

		const { spanId } = span.spanContext()
		if (this._parents.has(spanId)) {
			this._parents.delete(spanId)
			return true
		}

		return counter <= MAX_SPANS_PER_PERIOD_PER_COMPONENT
	}
}
