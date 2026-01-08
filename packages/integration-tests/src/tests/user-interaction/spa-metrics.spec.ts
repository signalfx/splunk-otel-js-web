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
import { expect } from '@playwright/test'

import { test } from '../../utils/test'

test.describe('spa-metrics', () => {
	test('routeChange span has duration after quiet period', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

		await recordPage.locator('#btnNavigate').click()

		// Wait for routeChange span (quietTime is 500ms in test config)
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')
		expect(routeChangeSpans).toHaveLength(1)
		expect(routeChangeSpans[0].name).toBe('routeChange')

		const duration = routeChangeSpans[0].duration
		// Duration should be 0 as no resources were loaded
		expect(duration).toBe(0)
	})

	test('routeChange span waits for fetch requests to complete', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

		await recordPage.locator('#btnNavigateWithFetch').click()

		// Wait for routeChange span
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')

		expect(routeChangeSpans).toHaveLength(1)

		// Duration should include fetch time + quiet period
		const duration = routeChangeSpans[0].duration
		expect(duration).toBeGreaterThan(0)
	})

	test('routeChange span waits for images to load', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/spa-metrics.ejs')

		await recordPage.locator('#btnNavigateWithImage').click()

		// Wait for routeChange span
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'routeChange').length === 1)

		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')

		expect(routeChangeSpans).toHaveLength(1)

		// Duration should include image load time + quiet period
		const duration = routeChangeSpans[0].duration
		expect(duration).toBeGreaterThan(0)
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
		expect(routeChangeSpans[0].duration).toBe(0)
		expect(routeChangeSpans[1].duration).toBeGreaterThanOrEqual(0)
		expect(routeChangeSpans[2].duration).toBeGreaterThanOrEqual(0)
		expect(routeChangeSpans[1].duration !== routeChangeSpans[2].duration).toBeTruthy()

		// Verify they have different location.href
		expect(routeChangeSpans[0].tags['location.href']).toContain('#page1')
		expect(routeChangeSpans[1].tags['location.href']).toContain('#page2')
		expect(routeChangeSpans[2].tags['location.href']).toContain('#page3')
	})
})
