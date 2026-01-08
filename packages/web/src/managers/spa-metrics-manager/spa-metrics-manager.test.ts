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

		expect(config.quietTime).toBe(5000)
		expect(config.maxResourcesToWatch).toBe(100)
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
		onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/api' })
		// @ts-expect-error loadingUrls is private. We use it for testing.
		expect(manager.loadingUrls.size).toBe(1)

		// Simulate resource loaded
		onResourceStateChange({
			loadTime: 50,
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: 'https://example.com/api',
		})

		// @ts-expect-error loadingUrls is private. We use it for testing.
		expect(manager.loadingUrls.size).toBe(0)

		manager.stop()
	})

	it('handles multiple requests to same URL', () => {
		const manager = new SpaMetricsManager()
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange
		const url = 'https://example.com/api'

		// Two requests to same URL
		onResourceStateChange({ state: ResourceState.DISCOVERED, url })
		onResourceStateChange({ state: ResourceState.DISCOVERED, url })
		// @ts-expect-error loadingUrls is private. We use it for testing.
		expect(manager.loadingUrls.get(url)).toBe(2)

		// First completes
		onResourceStateChange({ loadTime: 50, state: ResourceState.LOADED, timestamp: 0, url })
		// @ts-expect-error loadingUrls is private. We use it for testing.
		expect(manager.loadingUrls.get(url)).toBe(1)

		// Second completes
		onResourceStateChange({ loadTime: 50, state: ResourceState.LOADED, timestamp: 0, url })
		// @ts-expect-error loadingUrls is private. We use it for testing.
		expect(manager.loadingUrls.has(url)).toBe(false)

		manager.stop()
	})

	it('enforces maxResourcesToWatch limit', () => {
		const manager = new SpaMetricsManager({ maxResourcesToWatch: 2 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		// Add resources up to limit
		onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/1' })
		onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/2' })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)

		// Try to add beyond limit - should be ignored
		onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/3' })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)
		// @ts-expect-error loadingUrls is private. We use it for testing.
		expect(manager.loadingUrls.has('https://example.com/3')).toBe(false)

		// Complete one resource
		onResourceStateChange({ loadTime: 50, state: ResourceState.LOADED, timestamp: 0, url: 'https://example.com/1' })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(1)

		// Now new resource can be added
		onResourceStateChange({ state: ResourceState.DISCOVERED, url: 'https://example.com/3' })

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)
		// @ts-expect-error loadingUrls is private. We use it for testing.
		expect(manager.loadingUrls.has('https://example.com/3')).toBe(true)

		manager.stop()
	})
})
