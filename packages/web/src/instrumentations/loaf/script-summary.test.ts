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

import { createScript } from '@/tests/utils'

import { getLoafScriptSummaries } from './script-summary'

describe('LoAF script summaries', () => {
	it('exports the three longest scripts with raw browser source attribution', () => {
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
				invoker: 'https://example.com/large.js?token=secret#hash',
				invokerType: 'event-listener',
				pauseDuration: 0,
				sourceCharPosition: 0,
				sourceFunctionName: 'handler',
				sourceURL: 'https://example.com/large.js?a=1',
				startTime: 0,
				windowAttribution: 'self',
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
				windowAttribution: 'self',
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
				windowAttribution: 'self',
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
