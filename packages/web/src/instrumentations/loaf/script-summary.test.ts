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
import { normalizeLoafSourceUrl } from './source-url'
import { type PerformanceScriptTimingStable } from './types'

describe('LoAF script summaries', () => {
	it('exports the three longest scripts with normalized source URLs', () => {
		const summaries = getLoafScriptSummaries([
			createScript({ duration: 5, sourceURL: '/small.js?token=secret#hash' }),
			createScript({ duration: 40, invoker: 'setTimeout', sourceURL: 'https://example.com/large.js?a=1' }),
			createScript({ duration: 20, sourceURL: 'blob:https://example.com/id?kept=true#kept' }),
			createScript({ duration: 30, sourceURL: '<anonymous>' }),
		])

		expect(summaries).toEqual([
			{
				duration: 40,
				forcedStyleAndLayoutDuration: 0,
				invoker: 'setTimeout',
				invokerType: 'event-listener',
				sourceFunctionName: 'handler',
				sourceURL: 'https://example.com/large.js',
			},
			{
				duration: 30,
				forcedStyleAndLayoutDuration: 0,
				invoker: 'event-listener',
				invokerType: 'event-listener',
				sourceFunctionName: 'handler',
				sourceURL: '<anonymous>',
			},
			{
				duration: 20,
				forcedStyleAndLayoutDuration: 0,
				invoker: 'event-listener',
				invokerType: 'event-listener',
				sourceFunctionName: 'handler',
				sourceURL: 'blob:https://example.com/id?kept=true#kept',
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

describe('LoAF source URL normalization', () => {
	it('strips query strings and fragments from http URLs', () => {
		expect(normalizeLoafSourceUrl('/assets/app.js?token=secret#hash')).toBe(`${location.origin}/assets/app.js`)
		expect(normalizeLoafSourceUrl('chunk.js?token=secret#hash')).toBe(`${location.origin}/chunk.js`)
		expect(normalizeLoafSourceUrl('https://example.com/app.js?token=secret#hash')).toBe(
			'https://example.com/app.js',
		)
	})

	it('preserves opaque, non-http, anonymous, empty, and invalid source URLs', () => {
		expect(normalizeLoafSourceUrl('blob:https://example.com/app.js?token=secret#hash')).toBe(
			'blob:https://example.com/app.js?token=secret#hash',
		)
		expect(normalizeLoafSourceUrl('data:text/javascript,alert(1)')).toBe('data:text/javascript,alert(1)')
		expect(normalizeLoafSourceUrl('<anonymous>')).toBe('<anonymous>')
		expect(normalizeLoafSourceUrl('')).toBe('')
		expect(normalizeLoafSourceUrl('not a url')).toBe('not a url')
	})
})

function createScript({
	duration = 10,
	forcedStyleAndLayoutDuration = 0,
	invoker = 'event-listener',
	invokerType = 'event-listener',
	sourceFunctionName = 'handler',
	sourceURL = 'https://example.com/app.js',
}: Partial<{
	duration: number
	forcedStyleAndLayoutDuration: number
	invoker: string
	invokerType: string
	sourceFunctionName: string
	sourceURL: string
}> = {}): PerformanceScriptTimingStable {
	return {
		duration,
		entryType: 'script',
		forcedStyleAndLayoutDuration,
		invoker,
		invokerType,
		name: 'script',
		sourceFunctionName,
		sourceURL,
		startTime: 0,
		toJSON: () => ({}),
	}
}
