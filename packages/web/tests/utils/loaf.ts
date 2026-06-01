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

import {
	type PerformanceLongAnimationFrameTiming,
	type PerformanceScriptTiming,
	type ScriptInvokerType,
	type ScriptWindowAttribution,
} from '../../src/instrumentations/loaf/types'

export function createLoafEntry({
	blockingDuration = 111.4,
	duration = 161.381,
	firstUIEventTimestamp = 0,
	name = 'long-animation-frame',
	paintTime = 0,
	presentationTime = 0,
	renderStart = 0,
	scripts = [createScript()],
	startTime = 527.300_000_011_920_9,
	styleAndLayoutStart = 0,
}: Partial<{
	blockingDuration: number
	duration: number
	firstUIEventTimestamp: number
	name: string
	paintTime: number
	presentationTime: number
	renderStart: number
	scripts: PerformanceScriptTiming[]
	startTime: number
	styleAndLayoutStart: number
}> = {}): PerformanceLongAnimationFrameTiming {
	return {
		blockingDuration,
		duration,
		entryType: 'long-animation-frame',
		firstUIEventTimestamp,
		name,
		paintTime,
		presentationTime,
		renderStart,
		scripts,
		startTime,
		styleAndLayoutStart,
		toJSON: () => ({}),
	}
}

export function createScript({
	duration = 10,
	executionStart = 0,
	forcedStyleAndLayoutDuration = 0,
	invoker = 'event-listener',
	invokerType = 'event-listener',
	pauseDuration = 0,
	sourceCharPosition = 0,
	sourceFunctionName = 'handler',
	sourceURL = 'https://example.com/app.js',
	startTime = 0,
	windowAttribution = 'self',
}: Partial<{
	duration: number
	executionStart: number
	forcedStyleAndLayoutDuration: number
	invoker: string
	invokerType: ScriptInvokerType
	pauseDuration: number
	sourceCharPosition: number
	sourceFunctionName: string
	sourceURL: string
	startTime: number
	windowAttribution: ScriptWindowAttribution
}> = {}): PerformanceScriptTiming {
	return {
		duration,
		entryType: 'script',
		executionStart,
		forcedStyleAndLayoutDuration,
		invoker,
		invokerType,
		name: 'script',
		pauseDuration,
		sourceCharPosition,
		sourceFunctionName,
		sourceURL,
		startTime,
		toJSON: () => ({}),
		windowAttribution,
	}
}
