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

import { MAX_LOAF_SCRIPT_SUMMARIES } from './constants'
import { normalizeLoafInvoker, normalizeLoafSourceUrl } from './source-url'
import { type LoafScriptSummary, type PerformanceScriptTimingStable } from './types'

export function getLoafScriptSummaries(scripts: readonly PerformanceScriptTimingStable[]): LoafScriptSummary[] {
	return scripts
		.map((script, index) => ({ index, script }))
		.toSorted((left, right) => {
			const durationDelta = right.script.duration - left.script.duration
			return durationDelta || left.index - right.index
		})
		.slice(0, MAX_LOAF_SCRIPT_SUMMARIES)
		.map(({ script }) => ({
			duration: script.duration,
			executionStart: script.executionStart,
			forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
			invoker: normalizeLoafInvoker(script.invoker),
			invokerType: script.invokerType,
			pauseDuration: script.pauseDuration,
			sourceCharPosition: script.sourceCharPosition,
			sourceFunctionName: script.sourceFunctionName,
			sourceURL: normalizeLoafSourceUrl(script.sourceURL),
			startTime: script.startTime,
		}))
}
