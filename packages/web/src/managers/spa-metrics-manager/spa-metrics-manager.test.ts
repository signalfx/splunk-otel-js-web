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

import { diag } from '@opentelemetry/api'
import { describe, expect, it, vi } from 'vitest'

import { HTTP_TEST_SERVER_URL } from '../../../../../tests/servers/http-constants'
import { PAGE_LOAD_METRICS_STATUS_INTERRUPTED, PAGE_LOAD_METRICS_STATUS_TIMEOUT } from './constants'
import { ResourceState } from './monitors'
import { getDocumentLoadTime, SpaMetricsManager } from './spa-metrics-manager'

const TEST_API_URL = `${HTTP_TEST_SERVER_URL}/some-data`
const TEST_BEACON_ENDPOINT = `${HTTP_TEST_SERVER_URL}/v1/rum`

describe('SpaMetricsManager', () => {
	it('uses default config values', () => {
		const manager = new SpaMetricsManager()

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.quietTime).toBe(1000)
		expect(config.maxPageLoadWaitTime).toBe(180_000)
		expect(config.maxResourcesToWatch).toBe(100)
		expect(config.ignoreUrls).toEqual([])
	})

	it('applies custom config', () => {
		const manager = new SpaMetricsManager({
			ignoreUrls: [/test/],
			maxPageLoadWaitTime: 5000,
			quietTime: 2000,
		})

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.quietTime).toBe(2000)
		expect(config.maxPageLoadWaitTime).toBe(5000)
		expect(config.maxResourcesToWatch).toBe(100)
		expect(config.ignoreUrls).toHaveLength(1)
	})

	it('uses quiet time as max page load wait time and warns once when configured max is lower', () => {
		const diagWarnSpy = vi.spyOn(diag, 'warn')
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 5, quietTime: 30 })

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.maxPageLoadWaitTime).toBe(30)
		expect(diagWarnSpy).toHaveBeenCalledTimes(1)
		expect(diagWarnSpy).toHaveBeenCalledWith(
			'spa.maxPageLoadWaitTime cannot be lower than quietTime. Using quietTime as maxPageLoadWaitTime.',
			{ maxPageLoadWaitTime: 5, quietTime: 30 },
		)

		diagWarnSpy.mockRestore()
	})

	it('adds beacon endpoint origin to ignoreUrls', () => {
		const manager = new SpaMetricsManager({
			beaconEndpoint: TEST_BEACON_ENDPOINT,
		})

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.ignoreUrls).toHaveLength(1)
		expect(
			config.ignoreUrls[0] instanceof RegExp && config.ignoreUrls[0].test(`${HTTP_TEST_SERVER_URL}/anything`),
		).toBe(true)
		expect(config.ignoreUrls[0] instanceof RegExp && config.ignoreUrls[0].test('https://other.com/path')).toBe(
			false,
		)
	})

	it('start/stop controls monitoring state', () => {
		const manager = new SpaMetricsManager()

		// @ts-expect-error isMonitoring is private. We use it for testing.
		expect(manager.isMonitoring).toBe(false)

		manager.start()
		// @ts-expect-error isMonitoring is private. We use it for testing.
		expect(manager.isMonitoring).toBe(true)

		// Starting again should not change state
		manager.start()
		// @ts-expect-error isMonitoring is private. We use it for testing.
		expect(manager.isMonitoring).toBe(true)

		manager.stop()
		// @ts-expect-error isMonitoring is private. We use it for testing.
		expect(manager.isMonitoring).toBe(false)

		// Stopping again should not throw
		manager.stop()
		// @ts-expect-error isMonitoring is private. We use it for testing.
		expect(manager.isMonitoring).toBe(false)
	})

	it('waitForPageLoad returns promise that resolves after quiet period', async () => {
		const manager = new SpaMetricsManager({ quietTime: 100 })
		manager.start()

		const promise = manager.waitForPageLoad({ startTime: performance.now() })
		await fetch('data:text/plain,hello')

		const result = await promise
		expect(result).toHaveProperty('pct')
		expect(result.status).toBeUndefined()

		manager.stop()
	})

	it('waitForPageLoad with startTime 0 returns pct at least document load time', async () => {
		const manager = new SpaMetricsManager({ quietTime: 100 })
		manager.start()

		const promise = manager.waitForPageLoad({ startTime: 0 })
		const result = await promise

		const navEntry = performance.getEntriesByType('navigation')[0]
		const documentLoadTime = getDocumentLoadTime(navEntry)

		expect(result.pct).toBeGreaterThanOrEqual(documentLoadTime)
		expect(result.pct).toBeGreaterThan(0)
		expect(result.status).toBeUndefined()

		manager.stop()
	})

	it('waitForPageLoad resolves with timeout status when max page load wait time expires', async () => {
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 3000, quietTime: 1000 })
		manager.start()
		const slowResourceAbortController = new AbortController()

		try {
			const startTime = performance.now()
			void fetch(`${HTTP_TEST_SERVER_URL}/some-data?delay=5000`, {
				signal: slowResourceAbortController.signal,
			}).catch(() => {})
			const result = await manager.waitForPageLoad({ startTime })

			expect(result.pct).toBe(3000)
			expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
		} finally {
			slowResourceAbortController.abort()
			manager.stop()
		}
	})

	it('waitForPageLoad resolves with interrupted status when page hides', async () => {
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 5000, quietTime: 1000 })
		manager.start()

		try {
			const promise = manager.waitForPageLoad({ startTime: performance.now() })

			// @ts-expect-error onResourceStateChange is private. We use it for testing.
			manager.onResourceStateChange({ state: ResourceState.DISCOVERED, url: TEST_API_URL })
			window.dispatchEvent(new Event('pagehide'))

			const result = await promise
			expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
		} finally {
			manager.stop()
		}
	})

	it('waitForPageLoad resolves with interrupted status when stopped', async () => {
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 5000, quietTime: 1000 })
		manager.start()

		const promise = manager.waitForPageLoad({ startTime: performance.now() })
		manager.stop()

		const result = await promise
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
	})

	it('tracks loading resources and manages quiet timer', () => {
		const manager = new SpaMetricsManager({ quietTime: 100 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		// Simulate resource discovery
		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: TEST_API_URL })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		// Simulate resource loaded
		onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)

		manager.stop()
	})

	it('handles multiple requests to same URL', () => {
		const manager = new SpaMetricsManager()
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange
		const url = TEST_API_URL

		// Two requests to same URL with different IDs
		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url })
		onResourceStateChange({ id: 'r_2', state: ResourceState.DISCOVERED, url })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(2)

		// First completes
		onResourceStateChange({ id: 'r_1', loadTime: 50, state: ResourceState.LOADED, timestamp: 0, url })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		// Second completes
		onResourceStateChange({ id: 'r_2', loadTime: 50, state: ResourceState.LOADED, timestamp: 0, url })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)

		manager.stop()
	})

	it('enforces maxResourcesToWatch limit', () => {
		const manager = new SpaMetricsManager({ maxResourcesToWatch: 2 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		// Add resources up to limit
		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: `${TEST_API_URL}?resource=1` })
		onResourceStateChange({ id: 'r_2', state: ResourceState.DISCOVERED, url: `${TEST_API_URL}?resource=2` })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)

		// Try to add beyond limit - should be ignored
		onResourceStateChange({ id: 'r_3', state: ResourceState.DISCOVERED, url: `${TEST_API_URL}?resource=3` })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_3')).toBe(false)

		// Complete one resource
		onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			state: ResourceState.LOADED,
			timestamp: 0,
			url: `${TEST_API_URL}?resource=1`,
		})

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(1)

		// Now new resource can be added
		onResourceStateChange({ id: 'r_4', state: ResourceState.DISCOVERED, url: `${TEST_API_URL}?resource=3` })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_4')).toBe(true)

		manager.stop()
	})
})
