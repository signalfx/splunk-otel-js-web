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

import { SpanContext } from '@opentelemetry/api'
import { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base'

const MAX_ENTRIES = 20

interface TrackedClick {
	spanContext: SpanContext
	targetXpath: string
	timestamp: number
}

/**
 * Lightweight SpanProcessor that observes completed click spans and stores
 * their SpanContexts in a ring buffer. Used by ErrorClickDetector to create
 * span links from frustration spans to the original click spans.
 */
export class RecentClickSpanTracker implements SpanProcessor {
	private recentClicks: TrackedClick[] = []

	findClickSpan(targetXpath: string, beforeTimestamp: number, windowMs: number): SpanContext | undefined {
		for (let i = this.recentClicks.length - 1; i >= 0; i--) {
			const entry = this.recentClicks[i]
			if (entry.targetXpath === targetXpath && beforeTimestamp - entry.timestamp <= windowMs) {
				return entry.spanContext
			}
		}
		return undefined
	}

	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	onEnd(span: ReadableSpan): void {
		if (span.attributes['component'] === 'user-interaction' && span.attributes['event_type'] === 'click') {
			const hrTime = span.startTime
			const timestampMs = hrTime[0] * 1000 + hrTime[1] / 1e6

			this.recentClicks.push({
				spanContext: span.spanContext(),
				targetXpath: span.attributes['target_xpath'] as string,
				timestamp: timestampMs,
			})

			if (this.recentClicks.length > MAX_ENTRIES) {
				this.recentClicks.shift()
			}
		}
	}

	onStart(): void {}

	shutdown(): Promise<void> {
		return Promise.resolve()
	}
}
