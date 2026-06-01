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

import { LOAF_SOURCE_WINDOW_MS, MAX_LOAF_SPANS_PER_SOURCE_WINDOW } from './constants'
import { type PerformanceLongAnimationFrameTiming, type PerformanceScriptTiming } from './types'

export class LoafSpanRateLimiter {
	private emittedTimestampsBySourceKey = new Map<string, number[]>()

	shouldEmit(entry: PerformanceLongAnimationFrameTiming): boolean {
		const sourceKey = getLoafSourceRateLimitKey(entry)
		const emittedTimestamps = this.emittedTimestampsBySourceKey.get(sourceKey) ?? []
		const windowStart = entry.startTime - LOAF_SOURCE_WINDOW_MS

		// Performance timeline entries are processed in ascending startTime order.
		while (emittedTimestamps.length > 0 && emittedTimestamps[0] <= windowStart) {
			emittedTimestamps.shift()
		}

		if (emittedTimestamps.length >= MAX_LOAF_SPANS_PER_SOURCE_WINDOW) {
			return false
		}

		emittedTimestamps.push(entry.startTime)
		this.emittedTimestampsBySourceKey.set(sourceKey, emittedTimestamps)
		return true
	}
}

export function getLoafSourceRateLimitKey(entry: PerformanceLongAnimationFrameTiming): string {
	const longestScript = getLongestScript(entry.scripts)
	if (!longestScript) {
		return JSON.stringify(['frame', entry.entryType, entry.name])
	}

	return JSON.stringify([
		'script',
		longestScript.sourceURL,
		longestScript.invoker,
		longestScript.invokerType,
		longestScript.sourceFunctionName,
		longestScript.sourceCharPosition,
	])
}

function getLongestScript(
	scripts: readonly PerformanceScriptTiming[] | undefined,
): PerformanceScriptTiming | undefined {
	if (!scripts || scripts.length === 0) {
		return undefined
	}

	return scripts.reduce((longestScript, script) =>
		script.duration > longestScript.duration ? script : longestScript,
	)
}
