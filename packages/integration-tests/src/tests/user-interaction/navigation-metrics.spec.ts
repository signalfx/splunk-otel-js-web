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
import { hrTimeToMicroseconds } from '@opentelemetry/core'
import { expect } from '@playwright/test'

import { BROWSER_NAVIGATION_ATTRIBUTES, expectBrowserNavigationAttributes } from '../../utils/browser-navigation'
import { expectDefined, test } from '../../utils/test'

const getPageCompletionTime = (span: { attributes: Record<string, unknown> }) =>
	Number(span.attributes[BROWSER_NAVIGATION_ATTRIBUTES.pageCompletionTime])

const expectLoadedResourceAttributes = (
	span: { attributes: Record<string, unknown> },
	expected: { monitorType: string; url: string },
): void => {
	const lastLoadedResources = JSON.parse(
		String(span.attributes[BROWSER_NAVIGATION_ATTRIBUTES.lastLoadedResources]),
	) as Array<{ duration: number; monitorType: string; url: string }>
	const longestLoadedResource = JSON.parse(
		String(span.attributes[BROWSER_NAVIGATION_ATTRIBUTES.longestLoadedResource]),
	) as { duration: number; monitorType: string; url: string }

	expect(lastLoadedResources).toHaveLength(1)
	expect(lastLoadedResources[0].monitorType).toBe(expected.monitorType)
	expect(lastLoadedResources[0].url).toBe(expected.url)
	expect(lastLoadedResources[0].duration).toBeGreaterThanOrEqual(0)
	expect(longestLoadedResource.monitorType).toBe(expected.monitorType)
	expect(longestLoadedResource.url).toBe(expected.url)
	expect(longestLoadedResource.duration).toBeGreaterThanOrEqual(0)
}

test.describe('navigation-metrics', () => {
	test('routeChange span has duration after quiet period', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		await recordPage.locator('#btnNavigate').click()

		// Wait for routeChange span (quietTime is 500ms in test config)
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		expect(routeChangeSpans).toHaveLength(1)
		expect(routeChangeSpans[0].name).toBe('routeChange')
		expect(routeChangeSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.operation, 'routeChange')
		expectBrowserNavigationAttributes(routeChangeSpans[0], {
			detectedResourceCount: 0,
			pageCompletionTime: 0,
			quietTimerResetCount: 0,
			status: 'completed',
		})

		// Duration should be 0 as no resources were loaded
		expect(routeChangeSpans[0]).toHaveSpanDuration(0)
	})

	test('errors after a route change have the routeChange operation', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')
		await recordPage.locator('#btnNavigate').click()
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'routeChange'))

		await recordPage.evaluate(() => {
			setTimeout(() => {
				throw new Error('route change operation test')
			})
		})
		await recordPage.waitForSpans((spans) =>
			spans.some(
				(span) => span.name === 'onerror' && span.attributes['error.message'] === 'route change operation test',
			),
		)

		const errorSpan = recordPage.receivedSpans.find(
			(span) => span.name === 'onerror' && span.attributes['error.message'] === 'route change operation test',
		)
		expectDefined(errorSpan)
		expect(errorSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.operation, 'routeChange')
	})

	test('routeChange span waits for fetch requests to complete', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		await recordPage.locator('#btnNavigateWithFetch').click()

		// Wait for routeChange span
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		const fetchUrl = '/some-data?delay=300&resource=route-change-fetch'
		const fetchSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.attributes['component'] === 'fetch' &&
				span.attributes['http.url'] === `http://localhost:3000${fetchUrl}`,
		)

		expect(routeChangeSpans).toHaveLength(1)
		expect(fetchSpans).toHaveLength(1)
		expect(fetchSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.operation, 'routeChange')
		expect(fetchSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId, routeChangeSpans[0].spanId)
		expect(fetchSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pctRelevant, true)
		expectBrowserNavigationAttributes(routeChangeSpans[0], {
			detectedResourceCount: 1,
			quietTimerResetCount: 1,
			status: 'completed',
		})
		expectLoadedResourceAttributes(routeChangeSpans[0], {
			monitorType: 'network',
			url: fetchUrl,
		})
		expect(
			Number(routeChangeSpans[0].attributes[BROWSER_NAVIGATION_ATTRIBUTES.detectedResourceCount]),
		).toBeGreaterThan(0)

		// Duration should include fetch time + quiet period
		expect(routeChangeSpans[0]).toHaveSpanDurationGreaterThan(0)
	})

	test('routeChange span waits for XHR requests to complete', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		await recordPage.locator('#btnNavigateWithXhr').click()

		// Wait for routeChange span
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		const xhrUrl = '/some-data?delay=300&resource=route-change-xhr'
		const xhrSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.attributes['component'] === 'xml-http-request' &&
				span.attributes['http.url'] === `http://localhost:3000${xhrUrl}`,
		)

		expect(routeChangeSpans).toHaveLength(1)
		expect(xhrSpans).toHaveLength(1)
		expect(xhrSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.operation, 'routeChange')
		expect(xhrSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId, routeChangeSpans[0].spanId)
		expect(xhrSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pctRelevant, true)
		expectBrowserNavigationAttributes(routeChangeSpans[0], {
			detectedResourceCount: 1,
			quietTimerResetCount: 1,
			status: 'completed',
		})
		expectLoadedResourceAttributes(routeChangeSpans[0], {
			monitorType: 'network',
			url: xhrUrl,
		})

		// Duration should include XHR time + quiet period
		expect(routeChangeSpans[0]).toHaveSpanDurationGreaterThan(0)
	})

	test('routeChange span waits for images to load', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		await recordPage.locator('#btnNavigateWithImage').click()

		// Wait for routeChange span
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		const imageResourceSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.attributes['component'] === 'splunk-post-doc-load-resource' &&
				typeof span.attributes['http.url'] === 'string' &&
				String(span.attributes['http.url']).includes('/user-interaction/assets/splunk-black.png'),
		)

		expect(routeChangeSpans).toHaveLength(1)
		expect(imageResourceSpans).toHaveLength(1)
		expect(imageResourceSpans[0]).toHaveSpanAttribute(
			BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId,
			routeChangeSpans[0].spanId,
		)
		expect(imageResourceSpans[0]).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pctRelevant, true)
		expectBrowserNavigationAttributes(routeChangeSpans[0], { status: 'completed' })
		expect(
			Number(routeChangeSpans[0].attributes[BROWSER_NAVIGATION_ATTRIBUTES.detectedResourceCount]),
		).toBeGreaterThan(0)

		// Duration should include image load time + quiet period
		expect(routeChangeSpans[0]).toHaveSpanDurationGreaterThan(0)
	})

	test('spans after PCT retain the page span id and are marked not relevant', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		await recordPage.locator('#btnNavigate').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)
		await recordPage.locator('#btnFetchAfterPct').click()
		await recordPage.waitForSpans((spans) =>
			spans.some(
				(span) => span.attributes['http.url'] === 'http://localhost:3000/some-data?resource=after-pct-fetch',
			),
		)

		const routeChangeSpan = recordPage.receivedSpans.find((span) => span.name === 'routeChange')
		const afterPctFetchSpan = recordPage.receivedSpans.find(
			(span) => span.attributes['http.url'] === 'http://localhost:3000/some-data?resource=after-pct-fetch',
		)

		expectDefined(routeChangeSpan)
		expectDefined(afterPctFetchSpan)
		expect(afterPctFetchSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId, routeChangeSpan.spanId)
		expect(afterPctFetchSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pctRelevant, false)
	})

	test('network resources rejected by the active PCT monitor config are marked not relevant', async ({
		recordPage,
	}) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		await recordPage.locator('#btnNavigateWithNetworkDisabled').click()
		await recordPage.waitForSpans(
			(spans) =>
				spans.filter((span) => span.name === 'routeChange').length === 1 &&
				spans.some((span) => String(span.attributes['http.url']).includes('resource=override-slow-fetch')) &&
				spans.some((span) => String(span.attributes['http.url']).includes('resource=override-slow-xhr')),
		)

		const routeChangeSpan = recordPage.receivedSpans.find((span) => span.name === 'routeChange')
		const fetchSpan = recordPage.receivedSpans.find((span) =>
			String(span.attributes['http.url']).includes('resource=override-slow-fetch'),
		)
		const xhrSpan = recordPage.receivedSpans.find((span) =>
			String(span.attributes['http.url']).includes('resource=override-slow-xhr'),
		)

		expectDefined(routeChangeSpan)
		expectDefined(fetchSpan)
		expectDefined(xhrSpan)
		expectBrowserNavigationAttributes(routeChangeSpan, {
			detectedResourceCount: 0,
			pageCompletionTime: 0,
			quietTimerResetCount: 0,
			status: 'completed',
		})
		expect(fetchSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId, routeChangeSpan.spanId)
		expect(fetchSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pctRelevant, false)
		expect(xhrSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId, routeChangeSpan.spanId)
		expect(xhrSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pctRelevant, false)
	})

	for (const requestType of ['fetch', 'xhr'] as const) {
		test(`${requestType} span retains its original page attribution across overlapping navigations`, async ({
			recordPage,
		}) => {
			await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

			const button =
				requestType === 'fetch' ? '#btnNavigateWithOverlappingFetch' : '#btnNavigateWithOverlappingXhr'
			const component = requestType === 'fetch' ? 'fetch' : 'xml-http-request'
			const navigationAHash = `#overlapping-${requestType}-a`
			const requestUrl = `http://localhost:3000/some-data?delay=1500&resource=overlapping-navigation-${requestType}`

			// Start navigation A and its delayed request, then interrupt it with navigation B.
			await recordPage.locator(button).click()
			await expect
				.poll(() =>
					recordPage.evaluate(
						() => (window as unknown as { overlappingRequestStarted: string }).overlappingRequestStarted,
					),
				)
				.toBe(requestType)
			await recordPage.locator('#btnNavigate').click()
			await recordPage.waitForSpans(
				(spans) =>
					spans.filter((span) => span.name === 'routeChange').length === 2 &&
					spans.some(
						(span) =>
							span.attributes['component'] === component && span.attributes['http.url'] === requestUrl,
					),
			)

			const navigationASpan = recordPage.receivedSpans.find(
				(span) =>
					span.name === 'routeChange' && String(span.attributes['location.href']).includes(navigationAHash),
			)
			const navigationBSpan = recordPage.receivedSpans.find(
				(span) => span.name === 'routeChange' && String(span.attributes['location.href']).includes('#page1'),
			)
			const requestSpan = recordPage.receivedSpans.find(
				(span) => span.attributes['component'] === component && span.attributes['http.url'] === requestUrl,
			)

			expectDefined(navigationASpan)
			expectDefined(navigationBSpan)
			expectDefined(requestSpan)
			expect(navigationASpan.spanId).not.toBe(navigationBSpan.spanId)
			expect(requestSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId, navigationASpan.spanId)
			expect(requestSpan).not.toHaveSpanAttribute(
				BROWSER_NAVIGATION_ATTRIBUTES.pageSpanId,
				navigationBSpan.spanId,
			)
			expect(requestSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pctRelevant, false)
		})
	}

	test('multiple route changes each have their own duration', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		// First navigation
		await recordPage.locator('#btnNavigate').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		// Second navigation
		await recordPage.locator('#btnNavigateWithFetch').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 2)

		// Third navigation
		await recordPage.locator('#btnNavigateWithImage').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 3)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')

		expect(routeChangeSpans).toHaveLength(3)

		// Both spans should have meaningful duration
		expect(routeChangeSpans[0]).toHaveSpanDuration(0)
		expect(routeChangeSpans[1]).toHaveSpanDurationGreaterThanOrEqual(0)
		expect(routeChangeSpans[2]).toHaveSpanDurationGreaterThanOrEqual(0)
		expectBrowserNavigationAttributes(routeChangeSpans[0], {
			detectedResourceCount: 0,
			pageCompletionTime: 0,
			quietTimerResetCount: 0,
			status: 'completed',
		})
		expectBrowserNavigationAttributes(routeChangeSpans[1], { status: 'completed' })
		expectBrowserNavigationAttributes(routeChangeSpans[2], { status: 'completed' })
		expect(
			hrTimeToMicroseconds(routeChangeSpans[1].duration) !== hrTimeToMicroseconds(routeChangeSpans[2].duration),
		).toBeTruthy()

		// Verify they have different location.href
		expect(routeChangeSpans[0]).toHaveSpanAttributeContaining('location.href', '#page1')
		expect(routeChangeSpans[1]).toHaveSpanAttributeContaining('location.href', '#page2')
		expect(routeChangeSpans[2]).toHaveSpanAttributeContaining('location.href', '#page3')
	})

	// Temporarily skipped while PCT timeout is disabled.
	test.skip('URL override can disable network monitoring for a matched route', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')

		await recordPage.locator('#btnNavigateWithSlowFetch').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		await recordPage.locator('#btnNavigateWithNetworkDisabled').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 2)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		const globalConfigSpan = routeChangeSpans[0]
		const overrideConfigSpan = routeChangeSpans[1]
		const globalSlowFetchUrl = '/some-data?delay=1500&resource=global-slow-fetch'

		expect(globalConfigSpan).toHaveSpanAttributeContaining('location.href', '#slow-fetch')
		expectBrowserNavigationAttributes(globalConfigSpan, {
			pageCompletionTime: 1000,
			quietTimerResetCount: 0,
			status: 'timeout',
		})
		expect(
			Number(globalConfigSpan.attributes[BROWSER_NAVIGATION_ATTRIBUTES.detectedResourceCount]),
		).toBeGreaterThanOrEqual(1)
		expect(globalConfigSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.loadingResourceCount, 1)
		expect(globalConfigSpan).toHaveSpanAttribute(
			BROWSER_NAVIGATION_ATTRIBUTES.loadingResourceUrls,
			JSON.stringify([globalSlowFetchUrl]),
		)

		expect(overrideConfigSpan).toHaveSpanAttributeContaining('location.href', '#network-disabled')
		expectBrowserNavigationAttributes(overrideConfigSpan, {
			detectedResourceCount: 0,
			pageCompletionTime: 0,
			quietTimerResetCount: 0,
			status: 'completed',
		})
	})

	test('routeChange span waits for loading element selectors to disappear', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/navigation-metrics.ejs')
		const loadingElementVisibleTimeMs = await recordPage.evaluate(
			() => (window as unknown as { loadingElementVisibleTimeMs: number }).loadingElementVisibleTimeMs,
		)

		await recordPage.locator('#btnNavigateWithLoadingElement').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		await recordPage.locator('#btnNavigateWithOverrideLoadingElement').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 2)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		const globalSelectorSpan = routeChangeSpans[0]
		const overrideSelectorSpan = routeChangeSpans[1]

		expect(globalSelectorSpan).toHaveSpanAttributeContaining('location.href', '#loading-element')
		expectBrowserNavigationAttributes(globalSelectorSpan, {
			detectedResourceCount: 1,
			quietTimerResetCount: 1,
			status: 'completed',
		})
		expectLoadedResourceAttributes(globalSelectorSpan, {
			monitorType: 'elements',
			url: 'element:.global-loading-spinner',
		})
		expect(globalSelectorSpan).toHaveSpanDurationGreaterThan(loadingElementVisibleTimeMs * 1000)
		expect(getPageCompletionTime(globalSelectorSpan)).toBeGreaterThan(loadingElementVisibleTimeMs)
		expect(globalSelectorSpan).toNotHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.loadingResourceCount)

		expect(overrideSelectorSpan).toHaveSpanAttributeContaining('location.href', '#override-loading-element')
		expectBrowserNavigationAttributes(overrideSelectorSpan, {
			detectedResourceCount: 1,
			quietTimerResetCount: 1,
			status: 'completed',
		})
		expectLoadedResourceAttributes(overrideSelectorSpan, {
			monitorType: 'elements',
			url: 'element:[data-override-loading]',
		})
		expect(overrideSelectorSpan).toHaveSpanDurationGreaterThan(loadingElementVisibleTimeMs * 1000)
		expect(getPageCompletionTime(overrideSelectorSpan)).toBeGreaterThan(loadingElementVisibleTimeMs)
		expect(overrideSelectorSpan).toNotHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.loadingResourceCount)
	})
})
