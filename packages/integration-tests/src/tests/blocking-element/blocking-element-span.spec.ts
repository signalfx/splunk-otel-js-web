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
import { test } from '../../utils/test'

test.describe('blocking-element', () => {
	test('emits an independent span per element, one completed and one still open', async ({ recordPage }) => {
		await recordPage.goTo('/blocking-element/blocking-element-span.ejs')

		await recordPage.locator('#btnTwoSpinnersOneRemoved').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'blockingElement').length === 1)

		const blockingElementSpans = recordPage.receivedSpans.filter((span) => span.name === 'blockingElement')
		expect(blockingElementSpans).toHaveLength(1)

		const [completedSpan] = blockingElementSpans
		expect(completedSpan).toHaveSpanAttribute('browser.element.selector', '.global-spinner')
		expect(completedSpan).toHaveSpanAttribute('browser.element.id', 'spinner-first')
		expect(completedSpan).toHaveSpanAttribute('browser.element.completion', 'completed')
	})

	test('emits independently-timed spans for multiple elements, leaving one still open', async ({ recordPage }) => {
		await recordPage.goTo('/blocking-element/blocking-element-span.ejs')

		await recordPage.locator('#btnThreeSpinnersTwoRemoved').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'blockingElement').length === 2)

		const blockingElementSpans = recordPage.receivedSpans.filter((span) => span.name === 'blockingElement')
		expect(blockingElementSpans).toHaveLength(2)

		const earlySpan = blockingElementSpans.find((span) => span.attributes['browser.element.id'] === 'spinner-early')
		const lateSpan = blockingElementSpans.find((span) => span.attributes['browser.element.id'] === 'spinner-late')
		expect(earlySpan).toBeDefined()
		expect(lateSpan).toBeDefined()
		expect(earlySpan).toHaveSpanAttribute('browser.element.selector', '.global-spinner')
		expect(earlySpan).toHaveSpanAttribute('browser.element.completion', 'completed')
		expect(lateSpan).toHaveSpanAttribute('browser.element.selector', '.global-spinner')
		expect(lateSpan).toHaveSpanAttribute('browser.element.completion', 'completed')

		// spinner-late stayed visible longer than spinner-early (300ms vs 100ms removal delay).
		expect(hrTimeToMicroseconds(lateSpan!.duration)).toBeGreaterThan(hrTimeToMicroseconds(earlySpan!.duration))

		// spinner-open-ended never gets removed, so its span never ends/exports.
		const openEndedSpan = blockingElementSpans.find(
			(span) => span.attributes['browser.element.id'] === 'spinner-open-ended',
		)
		expect(openEndedSpan).toBeUndefined()
	})

	test('emits exactly one span for an element matching two configured selectors', async ({ recordPage }) => {
		await recordPage.goTo('/blocking-element/blocking-element-span.ejs')

		await recordPage.locator('#btnMultiSelectorSpinner').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'blockingElement').length === 1)

		const blockingElementSpans = recordPage.receivedSpans.filter((span) => span.name === 'blockingElement')
		expect(blockingElementSpans).toHaveLength(1)
		expect(blockingElementSpans[0]).toHaveSpanAttribute(
			'browser.element.selector',
			'.global-spinner,[data-loading]',
		)
		expect(blockingElementSpans[0]).toHaveSpanAttribute('browser.element.id', 'spinner-multi-selector')
		expect(blockingElementSpans[0]).toHaveSpanAttribute('browser.element.completion', 'completed')
	})

	test('emits spans via the spaMetrics.blockingSelectors fallback with default blockingElement config', async ({
		recordPage,
	}) => {
		await recordPage.goTo('/blocking-element/blocking-element-span.ejs')

		await recordPage.locator('#btnTwoSpinnersOneRemoved').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'blockingElement').length === 1)

		const blockingElementSpans = recordPage.receivedSpans.filter((span) => span.name === 'blockingElement')
		expect(blockingElementSpans).toHaveLength(1)
		expect(blockingElementSpans[0]).toHaveSpanAttribute('browser.element.selector', '.global-spinner')
	})

	test('emits no spans when instrumentations.blockingElement is disabled, independent of spaMetrics', async ({
		recordPage,
	}) => {
		await recordPage.goTo('/blocking-element/blocking-element-span.ejs?disableInstrumentation=blockingElement')

		await recordPage.locator('#btnTwoSpinnersOneRemoved').click()

		// Give the (disabled) instrumentation the same window it would need to emit a span.
		await recordPage.waitForTimeoutAndFlushData(500)

		const blockingElementSpans = recordPage.receivedSpans.filter((span) => span.name === 'blockingElement')
		expect(blockingElementSpans).toHaveLength(0)
	})

	test('PCT and blockingElement both react to the same spinner through the shared visibility observer', async ({
		recordPage,
	}) => {
		await recordPage.goTo('/blocking-element/blocking-element-span.ejs')

		await recordPage.locator('#btnNavigateWithSpinner').click()

		await recordPage.waitForSpans(
			(spans) =>
				spans.filter((span) => span.name === 'routeChange').length === 1 &&
				spans.filter((span) => span.name === 'blockingElement').length === 1,
		)

		// PCT (LoadingElementMonitor, via SpaMetricsManager) waited on the same spinner...
		const routeChangeSpan = recordPage.receivedSpans.find((span) => span.name === 'routeChange')
		expect(routeChangeSpan).toBeDefined()
		expectBrowserNavigationAttributes(routeChangeSpan!, {
			detectedResourceCount: 1,
			quietTimerResetCount: 1,
			status: 'completed',
		})
		const lastLoadedResources = JSON.parse(
			String(routeChangeSpan!.attributes[BROWSER_NAVIGATION_ATTRIBUTES.lastLoadedResources]),
		) as Array<{ duration: number; monitorType: string; url: string }>
		expect(lastLoadedResources).toHaveLength(1)
		expect(lastLoadedResources[0].monitorType).toBe('elements')
		expect(lastLoadedResources[0].url).toBe('element:.global-spinner')

		// ...and blockingElement (SplunkBlockingElementInstrumentation) independently produced its
		// own span for the exact same element, both fed by one shared MutationObserver scan.
		const blockingElementSpan = recordPage.receivedSpans.find((span) => span.name === 'blockingElement')
		expect(blockingElementSpan).toBeDefined()
		expect(blockingElementSpan).toHaveSpanAttribute('browser.element.id', 'spinner-shared-observer')
		expect(blockingElementSpan).toHaveSpanAttribute('browser.element.selector', '.global-spinner')
		expect(blockingElementSpan).toHaveSpanAttribute('browser.element.completion', 'completed')
	})
})
