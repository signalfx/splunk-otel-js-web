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

import { type PerformanceLongAnimationFrameTiming, type PerformanceScriptTiming } from './types'

export type LoafScriptTimingOffsets = {
	endOffsetMicros: number
	startOffsetMicros: number
}

export function getLoafScriptTimingOffsets(
	script: Pick<PerformanceScriptTiming, 'startTime' | 'duration'>,
	entry: Pick<PerformanceLongAnimationFrameTiming, 'startTime' | 'duration'>,
): LoafScriptTimingOffsets | undefined {
	if (
		!Number.isFinite(script.startTime) ||
		!Number.isFinite(script.duration) ||
		!Number.isFinite(entry.startTime) ||
		!Number.isFinite(entry.duration) ||
		script.duration <= 0 ||
		entry.duration <= 0
	) {
		return undefined
	}

	const durationMicros = Math.round(entry.duration * 1000)
	if (!Number.isSafeInteger(durationMicros) || durationMicros <= 0) {
		return undefined
	}

	const rawStartOffset = script.startTime - entry.startTime
	const rawEndOffset = rawStartOffset + script.duration
	if (!Number.isFinite(rawStartOffset) || !Number.isFinite(rawEndOffset) || rawEndOffset <= rawStartOffset) {
		return undefined
	}

	const boundedStartOffset = Math.max(0, rawStartOffset)
	const boundedEndOffset = Math.min(entry.duration, rawEndOffset)
	if (boundedEndOffset <= boundedStartOffset) {
		return undefined
	}

	let startOffsetMicros = Math.min(durationMicros, Math.round(boundedStartOffset * 1000))
	let endOffsetMicros = Math.min(durationMicros, Math.round(boundedEndOffset * 1000))
	if (endOffsetMicros <= startOffsetMicros) {
		startOffsetMicros = Math.min(durationMicros, Math.floor(boundedStartOffset * 1000))
		endOffsetMicros = Math.min(durationMicros, Math.ceil(boundedEndOffset * 1000))
	}

	if (endOffsetMicros <= startOffsetMicros) {
		return undefined
	}

	return { endOffsetMicros, startOffsetMicros }
}
