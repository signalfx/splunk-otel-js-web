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

import {
	PAGE_LOAD_METRICS_STATUS_COMPLETED,
	PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
	PAGE_LOAD_METRICS_STATUS_TIMEOUT,
} from './constants'
import { type LoadedResourceDetails, type PageLoadMetricsResult, QuietPeriodAwaiter } from './quiet-period-awaiter'

type QuietPeriodAwaiterTestConfig = Omit<
	ConstructorParameters<typeof QuietPeriodAwaiter>[0],
	| 'getDetectedResourcesCount'
	| 'getLastLoadedResources'
	| 'getLoadingResourceUrls'
	| 'getLoadingResourcesCount'
	| 'getLongestLoadedResource'
>

const noLoadedResources: LoadedResourceDetails[] = []

function getNoLongestLoadedResource(): LoadedResourceDetails | undefined {
	return noLoadedResources[0]
}

function createQuietPeriodAwaiter(config: QuietPeriodAwaiterTestConfig = {}): QuietPeriodAwaiter {
	return new QuietPeriodAwaiter({
		getDetectedResourcesCount: () => 0,
		getLastLoadedResources: () => [],
		getLoadingResourcesCount: () => 0,
		getLoadingResourceUrls: () => [],
		getLongestLoadedResource: getNoLongestLoadedResource,
		maxPageLoadWaitTime: config.maxPageLoadWaitTime,
		quietTime: config.quietTime,
		startTime: config.startTime,
	})
}

function expectNoLoadingResources(result: PageLoadMetricsResult): void {
	expect(result.lastLoadedResources).toEqual([])
	expect(result.loadingResourcesCount).toBe(0)
	expect(result.loadingResourceUrls).toEqual([])
	expect(result.longestLoadedResource).toBeUndefined()
}

describe('QuietPeriodAwaiter', () => {
	it('resolves after quiet period expires', async () => {
		const startTime = performance.now()
		const awaiter = createQuietPeriodAwaiter({ quietTime: 100, startTime })
		const resourceLoadedTimestamp = startTime + 10
		awaiter.startQuietTimer({ resourceLoadedTimestamp })

		const result = await awaiter.promise

		expect(result).toHaveProperty('pct')
		expect(result.pct).toBe(10)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expectNoLoadingResources(result)
	})

	it('resets timer when removeQuietTimer is called', async () => {
		const awaiter = createQuietPeriodAwaiter({ quietTime: 500 })
		awaiter.startQuietTimer({ resourceLoadedTimestamp: performance.now() })

		await new Promise((resolve) => setTimeout(resolve, 250))
		awaiter.removeQuietTimer()
		const resourceLoadedTimestamp = performance.now()
		awaiter.startQuietTimer({ resourceLoadedTimestamp })

		const result = await awaiter.promise
		expect(result.pct).toBeGreaterThanOrEqual(250)
		expect(result.pct).toBeLessThan(300)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expect(result.quietTimerResetCount).toBe(1)
		expectNoLoadingResources(result)
	})

	it('keeps loaded resource details when quiet period completes', async () => {
		const loadedResource = {
			duration: 12,
			monitorType: 'network' as const,
			url: 'https://example.test/loaded-resource.js',
		}
		const awaiter = new QuietPeriodAwaiter({
			getDetectedResourcesCount: () => 1,
			getLastLoadedResources: () => [loadedResource],
			getLoadingResourcesCount: () => 0,
			getLoadingResourceUrls: () => ['https://example.test/resource.js'],
			getLongestLoadedResource: () => loadedResource,
			quietTime: 10,
			startTime: 1000,
		})

		awaiter.startQuietTimer({ resourceLoadedTimestamp: 1025 })
		const result = await awaiter.promise

		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expect(result.detectedResourcesCount).toBe(1)
		expect(result.lastLoadedResources).toEqual([loadedResource])
		expect(result.loadingResourcesCount).toBe(0)
		expect(result.loadingResourceUrls).toEqual([])
		expect(result.longestLoadedResource).toEqual(loadedResource)
		expect(result.quietTimerResetCount).toBe(0)
	})

	it('keeps the latest resource timestamp when quiet timers are started out of order', async () => {
		const awaiter = createQuietPeriodAwaiter({ quietTime: 10, startTime: 1000 })

		awaiter.startQuietTimer({ resourceLoadedTimestamp: 1500 })
		awaiter.removeQuietTimer()
		awaiter.startQuietTimer({ resourceLoadedTimestamp: 1200 })

		const result = await awaiter.promise
		expect(result.pct).toBe(500)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expect(result.quietTimerResetCount).toBe(1)
		expectNoLoadingResources(result)
	})

	it('complete() resolves immediately', async () => {
		const awaiter = createQuietPeriodAwaiter({ quietTime: 1000 })

		awaiter.complete({ areResourcesStillLoading: false })
		const result = await awaiter.promise
		expect(result.pct).toBeGreaterThanOrEqual(0)
		expect(result.pct).toBeLessThan(1000)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expectNoLoadingResources(result)
	})

	it('interrupt() resolves immediately with interrupted status', async () => {
		const awaiter = createQuietPeriodAwaiter({ maxPageLoadWaitTime: 5000, quietTime: 1000 })
		awaiter.startQuietTimer({ resourceLoadedTimestamp: performance.now() + 100 })

		awaiter.interrupt()
		const result = await awaiter.promise

		expect(result.pct).toBeGreaterThanOrEqual(0)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
		expectNoLoadingResources(result)
	})

	it('resolves with interrupted status when persisted pagehide fires', async () => {
		const awaiter = createQuietPeriodAwaiter({ maxPageLoadWaitTime: 5000, quietTime: 1000 })
		const event = new Event('pagehide') as PageTransitionEvent
		Object.defineProperty(event, 'persisted', { value: true })

		window.dispatchEvent(event)

		const result = await awaiter.promise
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
		expectNoLoadingResources(result)
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('does not resolve with interrupted status when beforeunload fires', async () => {
		const awaiter = createQuietPeriodAwaiter({ maxPageLoadWaitTime: 10, quietTime: 5 })

		window.dispatchEvent(new Event('beforeunload'))

		const result = await awaiter.promise
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
		expectNoLoadingResources(result)
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('resolves with timeout status when max page load wait time expires before quiet timer starts', async () => {
		const startTime = performance.now()
		const awaiter = createQuietPeriodAwaiter({ maxPageLoadWaitTime: 10, quietTime: 5, startTime })

		const result = await awaiter.promise

		expect(result.pct).toBe(10)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
		expectNoLoadingResources(result)
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('resolves only once when quiet period would expire after max page load wait time', async () => {
		const results: unknown[] = []
		const startTime = performance.now()
		const awaiter = createQuietPeriodAwaiter({ maxPageLoadWaitTime: 30, quietTime: 20, startTime })
		void awaiter.promise.then((promiseResult) => results.push(promiseResult))

		await new Promise((resolve) => setTimeout(resolve, 20))
		awaiter.startQuietTimer({ resourceLoadedTimestamp: performance.now() })
		const result = await awaiter.promise

		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(result.pct).toBe(30)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
		expectNoLoadingResources(result)
		expect(results).toHaveLength(1)
	})
})
