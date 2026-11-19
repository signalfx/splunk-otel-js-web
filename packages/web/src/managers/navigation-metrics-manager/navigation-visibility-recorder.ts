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

import type { Span } from '@opentelemetry/api'

type VisibilityTransition = {
	hidden: boolean
	time: number
}

type VisibilityCapture = {
	events: VisibilityTransition[]
	key: object | symbol | string
	spans: Set<Span>
}

const HIDDEN_RANGES_ATTRIBUTE = 'browser.navigation.hidden_ranges'
const MAX_REPORTED_HIDDEN_RANGES = 3
export const INITIAL_NAVIGATION_VISIBILITY_CAPTURE_KEY = 'initial-document-navigation'

type HiddenRange = {
	end_ms: number
	start_ms: number
}

export class NavigationVisibilityRecorder {
	private readonly captureGroups = new Map<VisibilityCapture['key'], VisibilityCapture>()

	private readonly captures = new Map<Span, { capture: VisibilityCapture; startTime: number }>()

	clear(): void {
		this.captures.clear()
		this.captureGroups.clear()
	}

	// All capture timestamps use the performance.now() clock, never epoch time.
	endCapture(span: Span, endTime = performance.now()): void {
		const captureForSpan = this.captures.get(span)
		if (!captureForSpan) {
			return
		}

		const { capture, startTime: spanStartTime } = captureForSpan
		const spanEndTime = Math.max(spanStartTime, endTime)
		const hiddenRanges = this.getHiddenRanges(capture, spanStartTime, spanEndTime)
		if (hiddenRanges.length > 0) {
			const reportedRanges = this.getLargestHiddenRanges(hiddenRanges)
			const totalHiddenDuration = hiddenRanges.reduce((total, range) => total + range.end_ms - range.start_ms, 0)
			span.setAttribute(
				HIDDEN_RANGES_ATTRIBUTE,
				JSON.stringify({
					count: hiddenRanges.length,
					duration: totalHiddenDuration,
					longest_ranges: reportedRanges,
				}),
			)
		}

		capture.spans.delete(span)
		this.captures.delete(span)
		if (capture.spans.size === 0) {
			this.captureGroups.delete(capture.key)
		}
	}

	recordVisibilityChange(time: number, hidden: boolean): void {
		for (const capture of this.captureGroups.values()) {
			const lastEvent = capture.events.at(-1)
			if (lastEvent?.hidden !== hidden) {
				capture.events.push({ hidden, time: Math.max(time, lastEvent?.time ?? time) })
			}
		}
	}

	startCapture(span: Span, key: VisibilityCapture['key'], startTime: number, initiallyHidden: boolean): void {
		let capture = this.captureGroups.get(key)
		if (!capture) {
			capture = {
				events: [{ hidden: initiallyHidden, time: startTime }],
				key,
				spans: new Set(),
			}
			this.captureGroups.set(key, capture)
		}

		capture.spans.add(span)
		this.captures.set(span, { capture, startTime })
	}

	private addHiddenRange(
		hiddenRanges: HiddenRange[],
		spanStartTime: number,
		startTime: number,
		endTime: number,
	): void {
		if (endTime <= startTime) {
			return
		}

		hiddenRanges.push({
			end_ms: endTime - spanStartTime,
			start_ms: startTime - spanStartTime,
		})
	}

	private getHiddenRanges(capture: VisibilityCapture, spanStartTime: number, spanEndTime: number): HiddenRange[] {
		const hiddenRanges: HiddenRange[] = []
		let hiddenStart: number | undefined
		for (const event of capture.events) {
			if (event.time < spanStartTime) {
				hiddenStart = event.hidden ? spanStartTime : undefined
				continue
			}

			if (event.time > spanEndTime) {
				break
			}

			if (event.hidden) {
				hiddenStart ??= event.time
			} else if (hiddenStart !== undefined) {
				this.addHiddenRange(
					hiddenRanges,
					spanStartTime,
					Math.max(spanStartTime, hiddenStart),
					Math.min(event.time, spanEndTime),
				)
				hiddenStart = undefined
			}
		}

		if (hiddenStart !== undefined) {
			this.addHiddenRange(hiddenRanges, spanStartTime, Math.max(spanStartTime, hiddenStart), spanEndTime)
		}

		return hiddenRanges
	}

	private getLargestHiddenRanges(hiddenRanges: HiddenRange[]): HiddenRange[] {
		return [...hiddenRanges]
			.toSorted((a, b) => {
				const durationDifference = b.end_ms - b.start_ms - (a.end_ms - a.start_ms)
				return durationDifference || a.start_ms - b.start_ms
			})
			.slice(0, MAX_REPORTED_HIDDEN_RANGES)
			.toSorted((a, b) => a.start_ms - b.start_ms)
	}
}

export const navigationVisibilityRecorder = new NavigationVisibilityRecorder()
