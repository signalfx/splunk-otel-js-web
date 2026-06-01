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

import type { INPMetricWithAttribution } from 'web-vitals/attribution'

type WebVitalsPerformanceLongAnimationFrameTiming =
	INPMetricWithAttribution['attribution']['longAnimationFrameEntries'][number]

export type ScriptInvokerType = PerformanceScriptTiming['invokerType']
export type ScriptWindowAttribution = PerformanceScriptTiming['windowAttribution']

export type PerformanceScriptTiming = NonNullable<INPMetricWithAttribution['attribution']['longestScript']>['entry']

export type PerformanceLongAnimationFrameTiming = Omit<WebVitalsPerformanceLongAnimationFrameTiming, 'scripts'> & {
	paintTime?: number
	presentationTime?: number
	scripts: readonly PerformanceScriptTiming[]
}

export type LoafScriptSummary = Pick<
	PerformanceScriptTiming,
	| 'duration'
	| 'executionStart'
	| 'forcedStyleAndLayoutDuration'
	| 'invoker'
	| 'invokerType'
	| 'pauseDuration'
	| 'sourceCharPosition'
	| 'sourceFunctionName'
	| 'sourceURL'
	| 'startTime'
	| 'windowAttribution'
>
