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

import { isCacheHit } from './cache'

function makeEntry(overrides: Partial<PerformanceResourceTiming> = {}): PerformanceResourceTiming {
	return {
		connectEnd: 0,
		connectStart: 0,
		contentType: '',
		decodedBodySize: 1000,
		deliveryType: '',
		domainLookupEnd: 0,
		domainLookupStart: 0,
		duration: 0,
		encodedBodySize: 1000,
		entryType: 'resource',
		fetchStart: 0,
		firstInterimResponseStart: 0,
		initiatorType: 'img',
		name: 'https://example.com/image.png',
		nextHopProtocol: 'h2',
		redirectEnd: 0,
		redirectStart: 0,
		renderBlockingStatus: 'non-blocking',
		requestStart: 0,
		responseEnd: 0,
		responseStart: 0,
		responseStatus: 200,
		secureConnectionStart: 0,
		serverTiming: [],
		startTime: 0,
		toJSON: () => ({}),
		transferSize: 5000,
		workerStart: 0,
		...overrides,
	} as PerformanceResourceTiming
}

describe('isCacheHit', () => {
	it('returns true for 304 responseStatus', () => {
		const entry = makeEntry({ responseStatus: 304, transferSize: 5000 })
		expect(isCacheHit(entry)).toBe(true)
	})

	it('returns true for local cache hit (transferSize=0, decodedBodySize>0)', () => {
		const entry = makeEntry({ decodedBodySize: 1000, responseStatus: 200, transferSize: 0 })
		expect(isCacheHit(entry)).toBe(true)
	})

	it('returns false when transferSize > 0 and responseStatus is not 304', () => {
		const entry = makeEntry({ decodedBodySize: 1000, responseStatus: 200, transferSize: 5000 })
		expect(isCacheHit(entry)).toBe(false)
	})

	it('returns undefined for cross-origin without Timing-Allow-Origin (transferSize=0, decodedBodySize=0)', () => {
		const entry = makeEntry({ decodedBodySize: 0, responseStatus: 0, transferSize: 0 })
		expect(isCacheHit(entry)).toBeUndefined()
	})

	it('returns undefined when transferSize is not available', () => {
		const entry = makeEntry({ responseStatus: 200 })
		Object.defineProperty(entry, 'transferSize', { value: undefined })
		Object.defineProperty(entry, 'decodedBodySize', { value: undefined })
		expect(isCacheHit(entry)).toBeUndefined()
	})

	it('returns true for 304 even when transferSize is unavailable', () => {
		const entry = makeEntry({ responseStatus: 304 })
		Object.defineProperty(entry, 'transferSize', { value: undefined })
		Object.defineProperty(entry, 'decodedBodySize', { value: undefined })
		expect(isCacheHit(entry)).toBe(true)
	})
})
