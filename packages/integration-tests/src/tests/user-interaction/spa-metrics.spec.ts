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

import { test } from '../../utils/test'

const getPageCompletionTime = (span: { attributes: Record<string, unknown> }) =>
	Number(span.attributes['browser.navigation.page_completion_time'])

test.describe('spa-metrics', () => {
	test('routeChange span has duration after quiet period', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

		await recordPage.locator('#btnNavigate').click()

		// Wait for routeChange span (quietTime is 500ms in test config)
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		expect(routeChangeSpans).toHaveLength(1)
		expect(routeChangeSpans[0].name).toBe('routeChange')

		// Duration should be 0 as no resources were loaded
		expect(routeChangeSpans[0]).toHaveSpanDuration(0)
	})

	test('routeChange span waits for fetch requests to complete', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

		await recordPage.locator('#btnNavigateWithFetch').click()

		// Wait for routeChange span
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')

		expect(routeChangeSpans).toHaveLength(1)

		// Duration should include fetch time + quiet period
		expect(routeChangeSpans[0]).toHaveSpanDurationGreaterThan(0)
	})

	test('routeChange span waits for images to load', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

		await recordPage.locator('#btnNavigateWithImage').click()

		// Wait for routeChange span
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')

		expect(routeChangeSpans).toHaveLength(1)

		// Duration should include image load time + quiet period
		expect(routeChangeSpans[0]).toHaveSpanDurationGreaterThan(0)
	})

	test('multiple route changes each have their own duration', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

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
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

		await recordPage.locator('#btnNavigateWithSlowFetch').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		await recordPage.locator('#btnNavigateWithNetworkDisabled').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 2)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		const globalConfigSpan = routeChangeSpans[0]
		const overrideConfigSpan = routeChangeSpans[1]

		expect(globalConfigSpan).toHaveSpanAttributeContaining('location.href', '#slow-fetch')
		expect(globalConfigSpan).toHaveSpanAttribute('browser.navigation.page_completion_time', 1000)
		expect(globalConfigSpan).toHaveSpanAttribute('browser.navigation.loading_resource_count', 1)
		expect(globalConfigSpan).toHaveSpanAttribute(
			'browser.navigation.loading_resource_urls',
			JSON.stringify(['/some-data?delay=1500&resource=global-slow-fetch']),
		)
		expect(globalConfigSpan).toHaveSpanAttribute('browser.navigation.status', 'timeout')

		expect(overrideConfigSpan).toHaveSpanAttributeContaining('location.href', '#network-disabled')
		expect(overrideConfigSpan).toHaveSpanAttribute('browser.navigation.page_completion_time', 0)
		expect(overrideConfigSpan).toHaveSpanAttribute('browser.navigation.status', 'completed')
	})

	test('routeChange span waits for loading element selectors to disappear', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')
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
		expect(globalSelectorSpan).toHaveSpanAttribute('browser.navigation.status', 'completed')
		expect(globalSelectorSpan).toHaveSpanDurationGreaterThan(loadingElementVisibleTimeMs * 1000)
		expect(getPageCompletionTime(globalSelectorSpan)).toBeGreaterThan(loadingElementVisibleTimeMs)
		expect(globalSelectorSpan).toNotHaveSpanAttribute('browser.navigation.loading_resource_count')

		expect(overrideSelectorSpan).toHaveSpanAttributeContaining('location.href', '#override-loading-element')
		expect(overrideSelectorSpan).toHaveSpanAttribute('browser.navigation.status', 'completed')
		expect(overrideSelectorSpan).toHaveSpanDurationGreaterThan(loadingElementVisibleTimeMs * 1000)
		expect(getPageCompletionTime(overrideSelectorSpan)).toBeGreaterThan(loadingElementVisibleTimeMs)
		expect(overrideSelectorSpan).toNotHaveSpanAttribute('browser.navigation.loading_resource_count')
	})
})
