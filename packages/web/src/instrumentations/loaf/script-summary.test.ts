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

import { describe, expect, it } from 'vitest'

import { getLoafScriptSummaries } from './script-summary'
import { type PerformanceScriptTimingStable } from './types'

describe('LoAF script summaries', () => {
	it('exports the three longest scripts with normalized source URLs', () => {
		const summaries = getLoafScriptSummaries([
			createScript({ duration: 5, sourceURL: '/small.js?token=secret#hash' }),
			createScript({
				duration: 40,
				invoker: 'https://example.com/large.js?token=secret#hash',
				sourceURL: 'https://example.com/large.js?a=1',
			}),
			createScript({ duration: 20, sourceURL: 'blob:https://example.com/id?kept=true#kept' }),
			createScript({ duration: 30, sourceURL: '<anonymous>' }),
		])

		expect(summaries).toEqual([
			{
				duration: 40,
				executionStart: 0,
				forcedStyleAndLayoutDuration: 0,
				invoker: 'https://example.com/large.js',
				invokerType: 'event-listener',
				pauseDuration: 0,
				sourceCharPosition: 0,
				sourceFunctionName: 'handler',
				sourceURL: 'https://example.com/large.js',
				startTime: 0,
			},
			{
				duration: 30,
				executionStart: 0,
				forcedStyleAndLayoutDuration: 0,
				invoker: 'event-listener',
				invokerType: 'event-listener',
				pauseDuration: 0,
				sourceCharPosition: 0,
				sourceFunctionName: 'handler',
				sourceURL: '<anonymous>',
				startTime: 0,
			},
			{
				duration: 20,
				executionStart: 0,
				forcedStyleAndLayoutDuration: 0,
				invoker: 'event-listener',
				invokerType: 'event-listener',
				pauseDuration: 0,
				sourceCharPosition: 0,
				sourceFunctionName: 'handler',
				sourceURL: 'blob:https://example.com/id?kept=true#kept',
				startTime: 0,
			},
		])
	})

	it('keeps original order when durations tie', () => {
		const summaries = getLoafScriptSummaries([
			createScript({ duration: 10, sourceFunctionName: 'first' }),
			createScript({ duration: 10, sourceFunctionName: 'second' }),
			createScript({ duration: 10, sourceFunctionName: 'third' }),
		])

		expect(summaries.map((script) => script.sourceFunctionName)).toEqual(['first', 'second', 'third'])
	})
})

function createScript({
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
}: Partial<{
	duration: number
	executionStart: number
	forcedStyleAndLayoutDuration: number
	invoker: string
	invokerType: string
	pauseDuration: number
	sourceCharPosition: number
	sourceFunctionName: string
	sourceURL: string
	startTime: number
}> = {}): PerformanceScriptTimingStable {
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
	}
}
