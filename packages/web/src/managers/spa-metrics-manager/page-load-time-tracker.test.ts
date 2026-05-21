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

import { ResourceState } from './monitors'
import { PageLoadTimeTracker } from './page-load-time-tracker'

describe('PageLoadTimeTracker', () => {
	it('returns pct after quiet period expires', async () => {
		const tracker = new PageLoadTimeTracker({ maxResourcesToWatch: 100, quietTime: 10 })
		const startTime = performance.now()

		const promise = tracker.start({ startTime })
		const result = await promise

		expect(result.pct).toBe(0)
		expect(result.timestampOfLastLoadedResource).toBe(startTime)
	})

	it('tracks loading resources and manages quiet timer', async () => {
		const tracker = new PageLoadTimeTracker({ maxResourcesToWatch: 100, quietTime: 100 })
		const startTime = performance.now()
		const promise = tracker.start({ startTime })

		tracker.onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/api' })
		expect(tracker.loadingUrls.size).toBe(1)

		const loadedAt = performance.now()
		tracker.onResourceStateChange({
			loadTime: 50,
			state: ResourceState.LOADED,
			timestamp: loadedAt,
			url: 'https://example.com/api',
		})

		expect(tracker.loadingUrls.size).toBe(0)

		const result = await promise
		expect(result.pct).toBe(loadedAt - startTime)
		expect(result.timestampOfLastLoadedResource).toBe(loadedAt)
	})

	it('handles multiple requests to same URL', () => {
		const tracker = new PageLoadTimeTracker({ maxResourcesToWatch: 100, quietTime: 100 })
		const url = 'https://example.com/api'

		tracker.onResourceStateChange({ state: ResourceState.DISCOVERED, url })
		tracker.onResourceStateChange({ state: ResourceState.DISCOVERED, url })
		expect(tracker.loadingUrls.get(url)).toBe(2)

		tracker.onResourceStateChange({ loadTime: 50, state: ResourceState.LOADED, timestamp: 0, url })
		expect(tracker.loadingUrls.get(url)).toBe(1)

		tracker.onResourceStateChange({ loadTime: 50, state: ResourceState.LOADED, timestamp: 0, url })
		expect(tracker.loadingUrls.has(url)).toBe(false)
	})

	it('enforces maxResourcesToWatch limit', () => {
		const tracker = new PageLoadTimeTracker({ maxResourcesToWatch: 2, quietTime: 100 })

		tracker.onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/1' })
		tracker.onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/2' })

		expect(tracker.loadingResourcesCount).toBe(2)

		tracker.onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/3' })

		expect(tracker.loadingResourcesCount).toBe(2)
		expect(tracker.loadingUrls.has('https://example.com/3')).toBe(false)

		tracker.onResourceStateChange({
			loadTime: 50,
			state: ResourceState.LOADED,
			timestamp: 0,
			url: 'https://example.com/1',
		})

		expect(tracker.loadingResourcesCount).toBe(1)

		tracker.onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/3' })

		expect(tracker.loadingResourcesCount).toBe(2)
		expect(tracker.loadingUrls.has('https://example.com/3')).toBe(true)
	})
})
