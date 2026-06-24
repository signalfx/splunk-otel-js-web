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

import { diag, type Span } from '@opentelemetry/api'
import { describe, expect, it, vi } from 'vitest'

import { HTTP_TEST_SERVER_URL } from '../../../../../tests/servers/http-constants'
import {
	BROWSER_NAVIGATION_DETECTED_RESOURCE_COUNT_ATTRIBUTE,
	BROWSER_NAVIGATION_LAST_LOADED_RESOURCES_ATTRIBUTE,
	BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE,
	BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
	BROWSER_NAVIGATION_LONGEST_LOADED_RESOURCE_ATTRIBUTE,
	BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE,
	BROWSER_NAVIGATION_QUIET_TIMER_RESET_COUNT_ATTRIBUTE,
	BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
	PAGE_LOAD_METRICS_STATUS_COMPLETED,
	PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
	PAGE_LOAD_METRICS_STATUS_TIMEOUT,
} from './constants'
import { ResourceState } from './monitors'
import { getDocumentLoadTime, SpaMetricsManager } from './spa-metrics-manager'

const TEST_API_URL = `${HTTP_TEST_SERVER_URL}/some-data`
const TEST_BEACON_ENDPOINT = `${HTTP_TEST_SERVER_URL}/v1/rum`

function createSpanMock(): { attributes: Record<string, number | string>; span: Span } {
	const attributes: Record<string, number | string> = {}
	const span = {
		setAttribute: (name: string, value: number | string) => {
			attributes[name] = value
			return span
		},
	} as Span

	return { attributes, span }
}

describe('SpaMetricsManager', () => {
	it('uses default config values', () => {
		const manager = new SpaMetricsManager()

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.quietTime).toBe(1000)
		expect(config.maxPageLoadWaitTime).toBe(180_000)
		expect(config.maxResourcesToWatch).toBe(100)
		expect(config.ignoreUrls).toEqual([])
		expect(config.blockingSelectors).toEqual([])
		expect(config.monitors).toEqual(['media', 'network', 'performance'])
		expect(config.clearLoadingResourcesOnNewPage).toBe(true)
	})

	it('applies custom config', () => {
		const manager = new SpaMetricsManager({
			blockingSelectors: ['.loading-spinner'],
			clearLoadingResourcesOnNewPage: false,
			ignoreUrls: [/test/],
			maxPageLoadWaitTime: 5000,
			monitors: ['network', 'elements'],
			quietTime: 2000,
		})

		// @ts-expect-error Config is private. We use it for testing.
		const config = manager.config

		expect(config.quietTime).toBe(2000)
		expect(config.maxPageLoadWaitTime).toBe(5000)
		expect(config.maxResourcesToWatch).toBe(100)
		expect(config.ignoreUrls).toHaveLength(1)
		expect(config.blockingSelectors).toEqual(['.loading-spinner'])
		expect(config.monitors).toEqual(['network', 'elements'])
		expect(config.clearLoadingResourcesOnNewPage).toBe(false)
	})

	it('uses the first matching URL override with string substring matching', () => {
		const manager = new SpaMetricsManager({
			quietTime: 1000,
			urlOverrides: [
				{
					ignoreUrls: [/first/],
					match: '/checkout',
					monitors: ['network'],
					quietTime: 2000,
				},
				{
					ignoreUrls: [/second/],
					match: /checkout/,
					monitors: ['media'],
					quietTime: 3000,
				},
			],
		})

		const config = manager.getConfigForUrl('https://example.test/checkout/payment')

		expect(config.quietTime).toBe(2000)
		expect(config.ignoreUrls).toEqual([/first/])
		expect(config.monitors).toEqual(['network'])
	})

	it('matches URL overrides with regular expressions', () => {
		const manager = new SpaMetricsManager({
			urlOverrides: [
				{
					match: /\/cart\/[0-9]+/,
					quietTime: 2000,
				},
			],
		})

		expect(manager.getConfigForUrl('https://example.test/cart/123').quietTime).toBe(2000)
		expect(manager.getConfigForUrl('https://example.test/cart/item').quietTime).toBe(1000)
	})

	it('matches URL overrides with global regular expressions repeatedly', () => {
		const manager = new SpaMetricsManager({
			urlOverrides: [
				{
					match: /\/cart\/[0-9]+/g,
					quietTime: 2000,
				},
			],
		})

		expect(manager.getConfigForUrl('https://example.test/cart/123').quietTime).toBe(2000)
		expect(manager.getConfigForUrl('https://example.test/cart/123').quietTime).toBe(2000)
	})

	it('replaces inherited array fields in URL overrides', () => {
		const manager = new SpaMetricsManager({
			blockingSelectors: ['.global-loading'],
			ignoreUrls: [/global/],
			monitors: ['media', 'network'],
			urlOverrides: [
				{
					blockingSelectors: ['.override-loading'],
					ignoreUrls: [/override/],
					match: '/checkout',
					monitors: ['performance'],
				},
			],
		})

		const config = manager.getConfigForUrl('https://example.test/checkout')

		expect(config.ignoreUrls).toEqual([/override/])
		expect(config.blockingSelectors).toEqual(['.override-loading'])
		expect(config.monitors).toEqual(['performance'])
	})

	it('inherits blocking selectors in URL overrides', () => {
		const manager = new SpaMetricsManager({
			blockingSelectors: ['.global-loading'],
			urlOverrides: [
				{
					match: '/checkout',
				},
			],
		})

		const config = manager.getConfigForUrl('https://example.test/checkout')

		expect(config.blockingSelectors).toEqual(['.global-loading'])
	})

	it('inherits and overrides clear loading resources config in URL overrides', () => {
		const manager = new SpaMetricsManager({
			clearLoadingResourcesOnNewPage: false,
			urlOverrides: [
				{
					match: '/inherit',
				},
				{
					clearLoadingResourcesOnNewPage: true,
					match: '/clear',
				},
			],
		})

		expect(manager.getConfigForUrl('https://example.test/inherit').clearLoadingResourcesOnNewPage).toBe(false)
		expect(manager.getConfigForUrl('https://example.test/clear').clearLoadingResourcesOnNewPage).toBe(true)
	})

	it('adds beacon endpoint origin to override ignoreUrls', () => {
		const manager = new SpaMetricsManager({
			beaconEndpoint: TEST_BEACON_ENDPOINT,
			urlOverrides: [
				{
					ignoreUrls: [],
					match: '/checkout',
				},
			],
		})

		const config = manager.getConfigForUrl('https://example.test/checkout')

		expect(config.ignoreUrls).toHaveLength(1)
		expect(
			config.ignoreUrls[0] instanceof RegExp && config.ignoreUrls[0].test(`${HTTP_TEST_SERVER_URL}/anything`),
		).toBe(true)
	})

	it('adds beacon endpoint origin to inherited override ignoreUrls', () => {
		const manager = new SpaMetricsManager({
			beaconEndpoint: TEST_BEACON_ENDPOINT,
			ignoreUrls: [/global/],
			urlOverrides: [
				{
					match: '/checkout',
				},
			],
		})

		const config = manager.getConfigForUrl('https://example.test/checkout')
		const beaconEndpointIgnoreUrls = config.ignoreUrls.filter(
			(ignoreUrl) => ignoreUrl instanceof RegExp && ignoreUrl.test(`${HTTP_TEST_SERVER_URL}/anything`),
		)

		expect(config.ignoreUrls).toHaveLength(2)
		expect(config.ignoreUrls[0]).toEqual(/global/)
		expect(beaconEndpointIgnoreUrls).toHaveLength(1)
	})

	it('normalizes inherited max page load wait time for URL overrides', () => {
		const diagWarnSpy = vi.spyOn(diag, 'warn')
		const manager = new SpaMetricsManager({
			maxPageLoadWaitTime: 5,
			quietTime: 5,
			urlOverrides: [
				{
					match: '/checkout',
					quietTime: 30,
				},
			],
		})

		const config = manager.getConfigForUrl('https://example.test/checkout')

		expect(config.maxPageLoadWaitTime).toBe(30)
		expect(diagWarnSpy).toHaveBeenCalledWith(
			'spa.maxPageLoadWaitTime cannot be lower than quietTime. Using quietTime as maxPageLoadWaitTime.',
			{ maxPageLoadWaitTime: 5, quietTime: 30 },
		)

		diagWarnSpy.mockRestore()
	})

	it('uses max page load wait time from URL overrides', () => {
		const manager = new SpaMetricsManager({
			maxPageLoadWaitTime: 5000,
			quietTime: 1000,
			urlOverrides: [
				{
					match: '/checkout',
					maxPageLoadWaitTime: 2500,
					quietTime: 2000,
				},
			],
		})

		const config = manager.getConfigForUrl('https://example.test/checkout')

		expect(config.maxPageLoadWaitTime).toBe(2500)
		expect(config.quietTime).toBe(2000)
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

	it('starts every monitor regardless of configured monitor types', () => {
		const manager = new SpaMetricsManager({ monitors: ['network'] })

		// @ts-expect-error monitors is private. We use it for testing.
		const monitors = manager.monitors
		const elementsStart = vi.spyOn(monitors.elements, 'start').mockImplementation(() => {})
		const fetchXhrStart = vi.spyOn(monitors.network, 'start').mockImplementation(() => {})
		const mediaStart = vi.spyOn(monitors.media, 'start').mockImplementation(() => {})
		const performanceStart = vi.spyOn(monitors.performance, 'start').mockImplementation(() => {})

		try {
			manager.start()

			expect(elementsStart).toHaveBeenCalledOnce()
			expect(fetchXhrStart).toHaveBeenCalledOnce()
			expect(mediaStart).toHaveBeenCalledOnce()
			expect(performanceStart).toHaveBeenCalledOnce()
		} finally {
			manager.stop()
			elementsStart.mockRestore()
			fetchXhrStart.mockRestore()
			mediaStart.mockRestore()
			performanceStart.mockRestore()
		}
	})

	it('waitForPageLoad returns promise that resolves after quiet period', async () => {
		const manager = new SpaMetricsManager({ quietTime: 100 })
		manager.start()

		const promise = manager.waitForPageLoad({ startTime: performance.now() })
		await fetch('data:text/plain,hello')

		const result = await promise
		expect(result).toHaveProperty('pct')
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expect(result.loadingResourcesCount).toBe(0)
		expect(result.loadingResourceUrls).toEqual([])

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
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expect(result.loadingResourcesCount).toBe(0)
		expect(result.loadingResourceUrls).toEqual([])

		manager.stop()
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('waitForPageLoad resolves with timeout status when max page load wait time expires', async () => {
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
			expect(result.detectedResourcesCount).toBeGreaterThanOrEqual(1)
			expect(result.loadingResourcesCount).toBe(1)
			expect(result.loadingResourceUrls).toEqual([`${HTTP_TEST_SERVER_URL}/some-data?delay=5000`])
			expect(result.quietTimerResetCount).toBe(0)
		} finally {
			slowResourceAbortController.abort()
			manager.stop()
		}
	})

	it('sets page load metric attributes on a span', () => {
		const manager = new SpaMetricsManager()
		const { attributes, span } = createSpanMock()
		const lastLoadedResources = [
			{ duration: 10, monitorType: 'network' as const, url: 'https://example.test/loaded-1' },
			{ duration: 25, monitorType: 'performance' as const, url: 'https://example.test/loaded-2' },
		]
		const longestLoadedResource = lastLoadedResources[1]

		manager.setPageLoadMetricAttributes(span, {
			detectedResourcesCount: 4,
			lastLoadedResources,
			loadingResourcesCount: 2,
			loadingResourceUrls: ['https://example.test/slow-1', 'https://example.test/slow-2'],
			longestLoadedResource,
			pct: 123,
			quietTimerResetCount: 3,
			status: PAGE_LOAD_METRICS_STATUS_TIMEOUT,
		})

		expect(attributes[BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE]).toBe(123)
		expect(attributes[BROWSER_NAVIGATION_STATUS_ATTRIBUTE]).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
		expect(attributes[BROWSER_NAVIGATION_DETECTED_RESOURCE_COUNT_ATTRIBUTE]).toBe(4)
		expect(attributes[BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE]).toBe(2)
		expect(attributes[BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE]).toBe(
			JSON.stringify(['https://example.test/slow-1', 'https://example.test/slow-2']),
		)
		expect(attributes[BROWSER_NAVIGATION_LAST_LOADED_RESOURCES_ATTRIBUTE]).toBe(JSON.stringify(lastLoadedResources))
		expect(attributes[BROWSER_NAVIGATION_LONGEST_LOADED_RESOURCE_ATTRIBUTE]).toBe(
			JSON.stringify(longestLoadedResource),
		)
		expect(attributes[BROWSER_NAVIGATION_QUIET_TIMER_RESET_COUNT_ATTRIBUTE]).toBe(3)
	})

	it('does not set loading resource attributes when no resources are loading', () => {
		const manager = new SpaMetricsManager()
		const { attributes, span } = createSpanMock()

		manager.setPageLoadMetricAttributes(span, {
			detectedResourcesCount: 0,
			lastLoadedResources: [],
			loadingResourcesCount: 0,
			loadingResourceUrls: [],
			longestLoadedResource: undefined,
			pct: 10,
			quietTimerResetCount: 0,
			status: PAGE_LOAD_METRICS_STATUS_COMPLETED,
		})

		expect(attributes[BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE]).toBe(10)
		expect(attributes[BROWSER_NAVIGATION_STATUS_ATTRIBUTE]).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expect(attributes[BROWSER_NAVIGATION_DETECTED_RESOURCE_COUNT_ATTRIBUTE]).toBe(0)
		expect(attributes[BROWSER_NAVIGATION_LAST_LOADED_RESOURCES_ATTRIBUTE]).toBeUndefined()
		expect(attributes[BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE]).toBeUndefined()
		expect(attributes[BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE]).toBeUndefined()
		expect(attributes[BROWSER_NAVIGATION_LONGEST_LOADED_RESOURCE_ATTRIBUTE]).toBeUndefined()
		expect(attributes[BROWSER_NAVIGATION_QUIET_TIMER_RESET_COUNT_ATTRIBUTE]).toBe(0)
	})

	it('waitForPageLoad sets page load metric attributes when a span is provided', async () => {
		const manager = new SpaMetricsManager({ monitors: [], quietTime: 1 })
		const { attributes, span } = createSpanMock()
		manager.start()

		try {
			const result = await manager.waitForPageLoad({ span, startTime: performance.now() })

			expect(attributes[BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE]).toBe(result.pct)
			expect(attributes[BROWSER_NAVIGATION_STATUS_ATTRIBUTE]).toBe(result.status)
			expect(attributes[BROWSER_NAVIGATION_DETECTED_RESOURCE_COUNT_ATTRIBUTE]).toBe(0)
			expect(attributes[BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE]).toBeUndefined()
			expect(attributes[BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE]).toBeUndefined()
			expect(attributes[BROWSER_NAVIGATION_QUIET_TIMER_RESET_COUNT_ATTRIBUTE]).toBe(0)
		} finally {
			manager.stop()
		}
	})

	it('waitForPageLoad sets loaded resource attributes when quiet period completes', async () => {
		const manager = new SpaMetricsManager({ quietTime: 1 })
		const { attributes, span } = createSpanMock()
		const loadedResource = {
			duration: 42,
			monitorType: 'performance' as const,
			url: `${TEST_API_URL}?resource=completed`,
		}

		try {
			const promise = manager.waitForPageLoad({ span, startTime: performance.now() })

			// @ts-expect-error onResourceStateChange is private. We use it for testing.
			manager.onResourceStateChange({
				id: 'completed-resource',
				monitorType: loadedResource.monitorType,
				state: ResourceState.DISCOVERED,
				url: loadedResource.url,
			})
			// @ts-expect-error onResourceStateChange is private. We use it for testing.
			manager.onResourceStateChange({
				id: 'completed-resource',
				loadTime: loadedResource.duration,
				monitorType: loadedResource.monitorType,
				state: ResourceState.LOADED,
				timestamp: performance.now(),
				url: loadedResource.url,
			})

			const result = await promise

			expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
			expect(result.lastLoadedResources).toEqual([loadedResource])
			expect(result.longestLoadedResource).toEqual(loadedResource)
			expect(attributes[BROWSER_NAVIGATION_LAST_LOADED_RESOURCES_ATTRIBUTE]).toBe(
				JSON.stringify([loadedResource]),
			)
			expect(attributes[BROWSER_NAVIGATION_LONGEST_LOADED_RESOURCE_ATTRIBUTE]).toBe(
				JSON.stringify(loadedResource),
			)
		} finally {
			manager.stop()
		}
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('waitForPageLoad reports visible loading elements on timeout', async () => {
		const loadingElement = document.createElement('div')
		loadingElement.className = 'loading-spinner'
		loadingElement.style.height = '10px'
		loadingElement.style.width = '10px'
		document.body.append(loadingElement)

		const manager = new SpaMetricsManager({
			blockingSelectors: ['.loading-spinner'],
			maxPageLoadWaitTime: 10,
			monitors: ['elements'],
			quietTime: 5,
		})

		const result = await manager.waitForPageLoad({ startTime: performance.now() })

		expect(result.pct).toBe(10)
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
		expect(result.loadingResourcesCount).toBe(1)
		expect(result.loadingResourceUrls).toEqual(['element:.loading-spinner'])
		loadingElement.remove()
		manager.stop()
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('re-tracks still-visible loading elements after clearing previous page resources', async () => {
		const loadingElement = document.createElement('div')
		loadingElement.className = 'loading-spinner'
		loadingElement.style.height = '10px'
		loadingElement.style.width = '10px'
		document.body.append(loadingElement)

		const manager = new SpaMetricsManager({
			blockingSelectors: ['.loading-spinner'],
			maxPageLoadWaitTime: 20,
			monitors: ['elements'],
			quietTime: 5,
		})
		manager.start()

		history.pushState({}, '', '#loading-previous-page')
		const firstPagePromise = manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)
		// @ts-expect-error loadingResources is private. We use it for testing.
		const firstResourceId = Array.from(manager.loadingResources.keys())[0]

		history.pushState({}, '', '#loading-next-page')
		const nextPagePromise = manager.waitForPageLoad({ startTime: performance.now() })
		const firstPageResult = await firstPagePromise

		expect(firstPageResult.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
		expect(firstPageResult.loadingResourcesCount).toBe(1)
		expect(firstPageResult.loadingResourceUrls).toEqual(['element:.loading-spinner'])
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)
		// @ts-expect-error loadingResources is private. We use it for testing.
		const nextResourceId = Array.from(manager.loadingResources.keys())[0]
		expect(nextResourceId).not.toBe(firstResourceId)

		const nextPageResult = await nextPagePromise

		expect(nextPageResult.pct).toBe(20)
		expect(nextPageResult.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
		expect(nextPageResult.loadingResourcesCount).toBe(1)
		expect(nextPageResult.loadingResourceUrls).toEqual(['element:.loading-spinner'])

		loadingElement.remove()
		manager.stop()
	})

	it('keeps still-visible loading elements when clearing previous page resources is disabled', async () => {
		const loadingElement = document.createElement('div')
		loadingElement.className = 'loading-spinner'
		loadingElement.style.height = '10px'
		loadingElement.style.width = '10px'
		document.body.append(loadingElement)

		const manager = new SpaMetricsManager({
			blockingSelectors: ['.loading-spinner'],
			clearLoadingResourcesOnNewPage: false,
			maxPageLoadWaitTime: 100,
			monitors: ['elements'],
			quietTime: 5,
		})
		manager.start()

		history.pushState({}, '', '#loading-previous-page')
		const firstPagePromise = manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)
		// @ts-expect-error loadingResources is private. We use it for testing.
		const firstResourceId = Array.from(manager.loadingResources.keys())[0]

		history.pushState({}, '', '#loading-next-page')
		const nextPagePromise = manager.waitForPageLoad({ startTime: performance.now() })
		const firstPageResult = await firstPagePromise

		expect(firstPageResult.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
		expect(firstPageResult.loadingResourcesCount).toBe(1)
		expect(firstPageResult.loadingResourceUrls).toEqual(['element:.loading-spinner'])
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(Array.from(manager.loadingResources.keys())[0]).toBe(firstResourceId)

		loadingElement.remove()

		const nextPageResult = await nextPagePromise

		expect(nextPageResult.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
		expect(nextPageResult.loadingResourcesCount).toBe(0)
		expect(nextPageResult.loadingResourceUrls).toEqual([])

		loadingElement.remove()
		manager.stop()
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('waitForPageLoad with startTime 0 does not exceed max page load wait time on timeout', async () => {
		const getEntriesByType = vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
			{
				fetchStart: 0,
				loadEventEnd: 1000,
			} as PerformanceNavigationTiming,
		])
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 10, quietTime: 5 })
		manager.start()

		try {
			// @ts-expect-error onResourceStateChange is private. We use it for testing.
			manager.onResourceStateChange({
				id: 'slow',
				monitorType: 'network',
				state: ResourceState.DISCOVERED,
				url: TEST_API_URL,
			})
			const result = await manager.waitForPageLoad({ startTime: 0 })

			expect(result.pct).toBe(10)
			expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
			expect(result.loadingResourcesCount).toBe(1)
			expect(result.loadingResourceUrls).toEqual([TEST_API_URL])
		} finally {
			getEntriesByType.mockRestore()
			manager.stop()
		}
	})

	it('waitForPageLoad resolves with interrupted status when page hides', async () => {
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 5000, quietTime: 1000 })
		manager.start()

		try {
			const promise = manager.waitForPageLoad({ startTime: performance.now() })

			// @ts-expect-error onResourceStateChange is private. We use it for testing.
			manager.onResourceStateChange({
				id: 'r_1',
				monitorType: 'network',
				state: ResourceState.DISCOVERED,
				url: TEST_API_URL,
			})
			window.dispatchEvent(new Event('pagehide'))

			const result = await promise
			expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
			expect(result.loadingResourcesCount).toBe(1)
			expect(result.loadingResourceUrls).toEqual([TEST_API_URL])
		} finally {
			manager.stop()
		}
	})

	it('waitForPageLoad resolves with interrupted status when stopped', async () => {
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 5000, quietTime: 1000 })
		manager.start()

		const promise = manager.waitForPageLoad({ startTime: performance.now() })
		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})
		manager.stop()

		const result = await promise
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_INTERRUPTED)
		expect(result.loadingResourcesCount).toBe(1)
		expect(result.loadingResourceUrls).toEqual([TEST_API_URL])
	})

	// Temporarily skipped while PCT timeout is disabled.
	it.skip('waitForPageLoad reports the last three loading resource URLs', async () => {
		const manager = new SpaMetricsManager({ maxPageLoadWaitTime: 10, quietTime: 5 })
		manager.start()
		const longResourceUrl = `${TEST_API_URL}?resource=4&${'a'.repeat(120)}`
		const truncatedLongResourceUrl = `${longResourceUrl.slice(0, 97)}...`

		try {
			for (const resourceIndex of [1, 2, 3, 4]) {
				// @ts-expect-error onResourceStateChange is private. We use it for testing.
				manager.onResourceStateChange({
					id: `r_${resourceIndex}`,
					monitorType: 'network',
					state: ResourceState.DISCOVERED,
					url: resourceIndex === 4 ? longResourceUrl : `${TEST_API_URL}?resource=${resourceIndex}`,
				})
			}

			const result = await manager.waitForPageLoad({ startTime: performance.now() })

			expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_TIMEOUT)
			expect(result.loadingResourcesCount).toBe(4)
			expect(result.loadingResourceUrls).toEqual([
				`${TEST_API_URL}?resource=2`,
				`${TEST_API_URL}?resource=3`,
				truncatedLongResourceUrl,
			])
		} finally {
			manager.stop()
		}
	})

	it('tracks loading resources and manages quiet timer', () => {
		const manager = new SpaMetricsManager({ quietTime: 100 })
		manager.start()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		const onResourceStateChange = manager.onResourceStateChange

		// Simulate resource discovery
		onResourceStateChange({ id: 'r_1', monitorType: 'network', state: ResourceState.DISCOVERED, url: TEST_API_URL })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		// Simulate resource loaded
		onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			monitorType: 'network',
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
		onResourceStateChange({ id: 'r_1', monitorType: 'network', state: ResourceState.DISCOVERED, url })
		onResourceStateChange({ id: 'r_2', monitorType: 'network', state: ResourceState.DISCOVERED, url })
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(2)

		// First completes
		onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			monitorType: 'network',
			state: ResourceState.LOADED,
			timestamp: 0,
			url,
		})
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		// Second completes
		onResourceStateChange({
			id: 'r_2',
			loadTime: 50,
			monitorType: 'network',
			state: ResourceState.LOADED,
			timestamp: 0,
			url,
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
		onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: `${TEST_API_URL}?resource=1`,
		})
		onResourceStateChange({
			id: 'r_2',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: `${TEST_API_URL}?resource=2`,
		})

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)

		// Try to add beyond limit - should be ignored
		onResourceStateChange({
			id: 'r_3',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: `${TEST_API_URL}?resource=3`,
		})

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_3')).toBe(false)

		// Complete one resource
		onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			monitorType: 'network',
			state: ResourceState.LOADED,
			timestamp: 0,
			url: `${TEST_API_URL}?resource=1`,
		})

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(1)

		// Now new resource can be added
		onResourceStateChange({
			id: 'r_4',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: `${TEST_API_URL}?resource=3`,
		})

		// @ts-expect-error loadingResourcesCount is private. We use it for testing.
		expect(manager.loadingResourcesCount).toBe(2)
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.has('r_4')).toBe(true)

		manager.stop()
	})

	it('ignores resource events from monitors disabled for the current URL', async () => {
		const manager = new SpaMetricsManager({ monitors: ['media'], quietTime: 10 })

		const promise = manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)

		const result = await promise
		expect(result.loadingResourcesCount).toBe(0)
		expect(result.loadingResourceUrls).toEqual([])
	})

	it('does not track visible loading elements when elements monitor is disabled', async () => {
		const loadingElement = document.createElement('div')
		loadingElement.className = 'loading-spinner'
		loadingElement.style.height = '10px'
		loadingElement.style.width = '10px'
		document.body.append(loadingElement)

		const manager = new SpaMetricsManager({
			blockingSelectors: ['.loading-spinner'],
			monitors: ['network'],
			quietTime: 10,
		})

		const result = await manager.waitForPageLoad({ startTime: performance.now() })

		expect(result.loadingResourcesCount).toBe(0)
		expect(result.loadingResourceUrls).toEqual([])
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)

		loadingElement.remove()
		manager.stop()
	})

	it('uses the current URL override config when handling resource events', () => {
		const manager = new SpaMetricsManager({
			monitors: ['network'],
			quietTime: 10,
			urlOverrides: [
				{
					match: '#media-only',
					monitors: ['media'],
				},
			],
		})

		location.hash = '#media-only'

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_2',
			monitorType: 'media',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		void manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_2',
			loadTime: 50,
			monitorType: 'media',
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})

	it('uses the current URL when a resource is discovered before the next waitForPageLoad starts', () => {
		const manager = new SpaMetricsManager({
			monitors: ['network'],
			quietTime: 10,
			urlOverrides: [
				{
					match: '#media-only',
					monitors: ['media'],
				},
			],
		})

		location.hash = '#media-only'
		void manager.waitForPageLoad({ startTime: performance.now() })

		location.hash = '#network-enabled'

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		void manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			monitorType: 'network',
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})

	it('clears loading resources discovered on previous pages by default', async () => {
		const manager = new SpaMetricsManager({ quietTime: 10 })

		history.pushState({}, '', '#previous-page')

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		history.pushState({}, '', '#next-page')

		const promise = manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			monitorType: 'network',
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)

		const result = await promise
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)
	})

	it('keeps resources discovered on the current page before waitForPageLoad starts', async () => {
		const manager = new SpaMetricsManager({ quietTime: 10 })

		history.pushState({}, '', '#current-page')

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})

		const promise = manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			monitorType: 'network',
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: TEST_API_URL,
		})

		const result = await promise
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})

	it('carries previous page loading resources when clearing is disabled', async () => {
		const manager = new SpaMetricsManager({
			clearLoadingResourcesOnNewPage: false,
			quietTime: 10,
		})

		history.pushState({}, '', '#previous-page')

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})

		history.pushState({}, '', '#next-page')

		const promise = manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			loadTime: 50,
			monitorType: 'network',
			state: ResourceState.LOADED,
			timestamp: performance.now(),
			url: TEST_API_URL,
		})

		const result = await promise
		expect(result.status).toBe(PAGE_LOAD_METRICS_STATUS_COMPLETED)

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})

	it('ignores resource events matching ignoreUrls', () => {
		const manager = new SpaMetricsManager({ ignoreUrls: [/ignore-me/] })

		// Monitors emit all matching resources. SpaMetricsManager applies ignoreUrls before tracking them.
		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: `${TEST_API_URL}?resource=ignore-me`,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})

	it('ignores data URL resource events', () => {
		const manager = new SpaMetricsManager()

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: 'data:text/plain,hello',
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})

	it('tracks resource events from monitors enabled for the current URL', () => {
		const manager = new SpaMetricsManager({ monitors: ['network'], quietTime: 10 })

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)
	})

	it('drops stale loading resources from monitors disabled by a URL override', () => {
		const manager = new SpaMetricsManager({
			clearLoadingResourcesOnNewPage: false,
			monitors: ['network'],
			quietTime: 10,
			urlOverrides: [
				{
					match: '#media-only',
					monitors: ['media'],
				},
			],
		})

		location.hash = '#network-enabled'

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: TEST_API_URL,
		})
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		location.hash = '#media-only'
		void manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})

	it('drops stale loading resources ignored by a URL override', () => {
		const manager = new SpaMetricsManager({
			clearLoadingResourcesOnNewPage: false,
			monitors: ['network'],
			quietTime: 10,
			urlOverrides: [
				{
					ignoreUrls: [/slow-resource/],
					match: '#ignore-slow-resource',
					monitors: ['network'],
				},
			],
		})

		location.hash = '#network-enabled'

		// @ts-expect-error onResourceStateChange is private. We use it for testing.
		manager.onResourceStateChange({
			id: 'r_1',
			monitorType: 'network',
			state: ResourceState.DISCOVERED,
			url: `${TEST_API_URL}?resource=slow-resource`,
		})
		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(1)

		location.hash = '#ignore-slow-resource'
		void manager.waitForPageLoad({ startTime: performance.now() })

		// @ts-expect-error loadingResources is private. We use it for testing.
		expect(manager.loadingResources.size).toBe(0)
	})
})
