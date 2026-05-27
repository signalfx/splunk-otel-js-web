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
import { SpaMetricsManager } from './spa-metrics-manager'

describe('SpaMetricsManager', () => {
	it('uses default config values', () => {
		const manager = new SpaMetricsManager()

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.quietTime).toBe(1000)
		expect(config.maxResourcesToWatch).toBe(100)
		expect(config.maxResourceWaitingTime).toBe(60_000)
		expect(config.ignoreUrls).toEqual([])
	})

	it('applies custom config', () => {
		const manager = new SpaMetricsManager({
			ignoreUrls: [/test/],
			quietTime: 2000,
		})

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.quietTime).toBe(2000)
		expect(config.maxResourcesToWatch).toBe(100)
		expect(config.ignoreUrls).toHaveLength(1)
	})

	it('adds beacon endpoint origin to ignoreUrls', () => {
		const manager = new SpaMetricsManager({
			beaconEndpoint: 'https://rum-ingest.example.com/v1/rum',
		})

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.ignoreUrls).toHaveLength(1)
		expect(
			config.ignoreUrls[0] instanceof RegExp &&
				config.ignoreUrls[0].test('https://rum-ingest.example.com/anything'),
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
		expect(result).toHaveProperty('loadTime')
		expect(result).toHaveProperty('timestampOfLastLoadedResource')

		manager.stop()
	})

	it('tracks loading resources and manages quiet timer', () => {
		const manager = new SpaMetricsManager({ quietTime: 100 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		// Simulate resource discovery
		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: 'https://example.com/api' })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		// Simulate resource loaded
		onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: 'https://example.com/api',
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
		const url = 'https://example.com/api'

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

	it('resolves waitForPageLoad when TIMEOUT event removes the last pending resource', async () => {
		const manager = new SpaMetricsManager({ quietTime: 50 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		const promise = manager.waitForPageLoad({ startTime: performance.now() })

		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: 'https://example.com/slow' })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_1')).toBe(true)

		onResourceStateChange({
			id: 'r_1',
			state: ResourceState.TIMEOUT,
			timestamp: performance.now(),
			url: 'https://example.com/slow',
		})

		const result = await promise

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_1')).toBe(false)
		expect(result).toHaveProperty('loadTime')

		manager.stop()
	})

	it('resolves normally when resource completes before maxResourceWaitingTime', async () => {
		const manager = new SpaMetricsManager({ maxResourceWaitingTime: 500, quietTime: 50 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		const promise = manager.waitForPageLoad({ startTime: performance.now() })

		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: 'https://example.com/fast' })
		onResourceStateChange({
			id: 'r_1',
			loadTime: 10,
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: 'https://example.com/fast',
		})

		const result = await promise
		expect(result.loadTime).toBeLessThan(100)

		manager.stop()
	})

	it('handles TIMEOUT event through onResourceStateChange', () => {
		const manager = new SpaMetricsManager({ maxResourceWaitingTime: 500 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: 'https://example.com/slow' })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_1')).toBe(true)

		onResourceStateChange({
			id: 'r_1',
			state: ResourceState.TIMEOUT,
			timestamp: performance.now(),
			url: 'https://example.com/slow',
		})
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_1')).toBe(false)

		manager.stop()
	})

	it('ignores late LOADED event after TIMEOUT', () => {
		const manager = new SpaMetricsManager({ maxResourceWaitingTime: 500 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: 'https://example.com/slow' })
		onResourceStateChange({
			id: 'r_1',
			state: ResourceState.TIMEOUT,
			timestamp: performance.now(),
			url: 'https://example.com/slow',
		})

		// Late LOADED after timeout should not throw or change state
		onResourceStateChange({
			id: 'r_1',
			loadTime: 70_000,
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: 'https://example.com/slow',
		})

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
		onResourceStateChange({ id: 'r_1', state: ResourceState.DISCOVERED, url: 'https://example.com/1' })
		onResourceStateChange({ id: 'r_2', state: ResourceState.DISCOVERED, url: 'https://example.com/2' })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)

		// Try to add beyond limit - should be ignored
		onResourceStateChange({ id: 'r_3', state: ResourceState.DISCOVERED, url: 'https://example.com/3' })

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
			url: 'https://example.com/1',
		})

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(1)

		// Now new resource can be added
		onResourceStateChange({ id: 'r_4', state: ResourceState.DISCOVERED, url: 'https://example.com/3' })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_4')).toBe(true)

		manager.stop()
	})
})
