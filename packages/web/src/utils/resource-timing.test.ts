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

import { getCrossOriginTimingRestricted } from './resource-timing'

describe('getCrossOriginTimingRestricted', () => {
	it('returns true when a cross-origin entry has hidden request and response timing and zero sizes', () => {
		expect(getCrossOriginTimingRestricted(createResourceEntry())).toBe(true)
	})

	it('returns false when a cross-origin entry exposes request and response timing', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({
					requestStart: 10,
					responseStart: 12,
				}),
			),
		).toBe(false)
	})

	it('omits the result for same-origin resources', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({ name: new URL('/resource.svg', self.origin).toString() }),
			),
		).toBeUndefined()
	})

	it('omits the result when timing and size fields have mixed signals', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({
					requestStart: 0,
					responseStart: 12,
				}),
			),
		).toBeUndefined()
	})

	it('omits the result when hidden timing is not corroborated by all zero sizes', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({
					decodedBodySize: 100,
				}),
			),
		).toBeUndefined()
	})

	it('omits the result when a required timing or size field is unavailable', () => {
		expect(getCrossOriginTimingRestricted(createResourceEntry({ encodedBodySize: undefined }))).toBeUndefined()
	})

	it('omits the result for non-HTTP resources', () => {
		expect(getCrossOriginTimingRestricted(createResourceEntry({ name: 'data:text/plain,resource' }))).toBeUndefined()
	})
})

function createResourceEntry(overrides: Partial<PerformanceResourceTiming> = {}): PerformanceResourceTiming {
	return {
		decodedBodySize: 0,
		encodedBodySize: 0,
		name: 'https://cdn.example.test/resource.svg',
		requestStart: 0,
		responseStart: 0,
		transferSize: 0,
		...overrides,
	} as PerformanceResourceTiming
}
