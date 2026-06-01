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

import { createLoafEntry, createScript } from '../../../tests/utils/loaf'
import { LOAF_SOURCE_WINDOW_MS, MAX_LOAF_SPANS_PER_SOURCE_WINDOW } from './constants'
import { getLoafSourceRateLimitKey, LoafSpanRateLimiter } from './rate-limit'

describe('LoAF span rate limiter', () => {
	it('allows spans for the same source up to the rolling window limit', () => {
		const limiter = new LoafSpanRateLimiter()

		for (let index = 0; index < MAX_LOAF_SPANS_PER_SOURCE_WINDOW; index += 1) {
			expect(limiter.shouldEmit(createLoafEntry({ startTime: index }))).toBe(true)
		}

		expect(limiter.shouldEmit(createLoafEntry({ startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW }))).toBe(false)
	})

	it('allows a source again when the oldest span reaches the rolling window boundary', () => {
		const limiter = new LoafSpanRateLimiter()

		for (let index = 0; index < MAX_LOAF_SPANS_PER_SOURCE_WINDOW; index += 1) {
			expect(limiter.shouldEmit(createLoafEntry({ startTime: index }))).toBe(true)
		}

		expect(limiter.shouldEmit(createLoafEntry({ startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW }))).toBe(false)
		expect(limiter.shouldEmit(createLoafEntry({ startTime: LOAF_SOURCE_WINDOW_MS }))).toBe(true)
	})

	it('limits different source keys independently', () => {
		const limiter = new LoafSpanRateLimiter()

		for (let index = 0; index < MAX_LOAF_SPANS_PER_SOURCE_WINDOW; index += 1) {
			expect(limiter.shouldEmit(createLoafEntry({ startTime: index }))).toBe(true)
		}

		expect(limiter.shouldEmit(createLoafEntry({ startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW }))).toBe(false)
		expect(
			limiter.shouldEmit(
				createLoafEntry({
					scripts: [createScript({ sourceFunctionName: 'otherHandler' })],
					startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW,
				}),
			),
		).toBe(true)
	})

	it('uses the longest script to build the source key', () => {
		const key = getLoafSourceRateLimitKey(
			createLoafEntry({
				scripts: [
					createScript({ duration: 5, sourceFunctionName: 'smallHandler' }),
					createScript({
						duration: 100,
						invoker: 'https://example.com/app.js?token=secret#hash',
						invokerType: 'event-listener',
						sourceCharPosition: 234,
						sourceFunctionName: 'largeHandler',
						sourceURL: 'https://example.com/app.js?token=secret#hash',
					}),
				],
			}),
		)

		expect(JSON.parse(key)).toEqual([
			'script',
			'https://example.com/app.js?token=secret#hash',
			'https://example.com/app.js?token=secret#hash',
			'event-listener',
			'largeHandler',
			234,
		])
	})

	it('keeps the first script as the source key when later scripts are not longer', () => {
		const key = getLoafSourceRateLimitKey(
			createLoafEntry({
				scripts: [
					createScript({
						duration: 100,
						sourceCharPosition: 10,
						sourceFunctionName: 'firstHandler',
						sourceURL: 'https://example.com/first.js?token=secret#hash',
					}),
					createScript({
						duration: 100,
						sourceCharPosition: 20,
						sourceFunctionName: 'equalHandler',
						sourceURL: 'https://example.com/equal.js?token=secret#hash',
					}),
					createScript({
						duration: 50,
						sourceCharPosition: 30,
						sourceFunctionName: 'shorterHandler',
						sourceURL: 'https://example.com/shorter.js?token=secret#hash',
					}),
				],
			}),
		)

		expect(JSON.parse(key)).toEqual([
			'script',
			'https://example.com/first.js?token=secret#hash',
			'event-listener',
			'event-listener',
			'firstHandler',
			10,
		])
	})

	it('uses source character position to rate-limit call sites independently', () => {
		const limiter = new LoafSpanRateLimiter()

		for (let index = 0; index < MAX_LOAF_SPANS_PER_SOURCE_WINDOW; index += 1) {
			expect(
				limiter.shouldEmit(
					createLoafEntry({
						scripts: [createScript({ sourceCharPosition: 10 })],
						startTime: index,
					}),
				),
			).toBe(true)
		}

		expect(
			limiter.shouldEmit(
				createLoafEntry({
					scripts: [createScript({ sourceCharPosition: 10 })],
					startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW,
				}),
			),
		).toBe(false)
		expect(
			limiter.shouldEmit(
				createLoafEntry({
					scripts: [createScript({ sourceCharPosition: 20 })],
					startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW,
				}),
			),
		).toBe(true)
		expect(
			getLoafSourceRateLimitKey(createLoafEntry({ scripts: [createScript({ sourceCharPosition: 10 })] })),
		).not.toBe(getLoafSourceRateLimitKey(createLoafEntry({ scripts: [createScript({ sourceCharPosition: 20 })] })))
	})

	it('uses a stable frame-level fallback key when script attribution is unavailable', () => {
		const limiter = new LoafSpanRateLimiter()
		const fallbackKey = getLoafSourceRateLimitKey(createLoafEntry({ scripts: [] }))

		expect(JSON.parse(fallbackKey)).toEqual(['frame', 'long-animation-frame', 'long-animation-frame'])

		for (let index = 0; index < MAX_LOAF_SPANS_PER_SOURCE_WINDOW; index += 1) {
			expect(limiter.shouldEmit(createLoafEntry({ scripts: [], startTime: index }))).toBe(true)
		}

		expect(
			limiter.shouldEmit(
				createLoafEntry({
					scripts: [],
					startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW,
				}),
			),
		).toBe(false)
	})
})
