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

import { afterEach, describe, expect, it, vi } from 'vitest'

import { didResourceStartAfterDocumentLoad } from './resource-span-dedupe'

afterEach(() => {
	vi.restoreAllMocks()
})

describe('resource span ownership', () => {
	it('leaves resources started by load event handlers to post-load instrumentation', () => {
		vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
			{ loadEventStart: 100 } as PerformanceNavigationTiming,
		])

		expect(didResourceStartAfterDocumentLoad(createResourceEntry(99))).toBe(false)
		expect(didResourceStartAfterDocumentLoad(createResourceEntry(100))).toBe(true)
		expect(didResourceStartAfterDocumentLoad(createResourceEntry(101))).toBe(true)
	})

	it('keeps document-load ownership when the load boundary is unavailable', () => {
		vi.spyOn(performance, 'getEntriesByType').mockReturnValue([])

		expect(didResourceStartAfterDocumentLoad(createResourceEntry(100))).toBe(false)
	})
})

function createResourceEntry(fetchStart: number): PerformanceResourceTiming {
	return { fetchStart } as PerformanceResourceTiming
}
