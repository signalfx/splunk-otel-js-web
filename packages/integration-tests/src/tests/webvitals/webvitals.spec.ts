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

import { expectDefined, test } from '../../utils/test'

test.describe('web vitals', () => {
	test('web vitals spans', async ({ browserName, recordPage }) => {
		// TODO: Investigate why this test is disabled on webkit and firefox
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals.ejs')

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		// webvitals library won't send the cls unless a visibility change happens, so
		// force a fake one
		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const lcp = recordPage.receivedSpans.filter((span) => span.tags.lcp !== undefined)
		expect(lcp).toHaveLength(1)

		const cls = recordPage.receivedSpans.filter((span) => span.tags.cls !== undefined)
		expect(cls).toHaveLength(1)

		const fid = recordPage.receivedSpans.filter((span) => span.tags.fid !== undefined)
		const inp = recordPage.receivedSpans.filter((span) => span.tags.inp !== undefined)

		if (fid.length > 0) {
			expect(fid[0].name).toBe('webvitals')
		}

		if (inp.length > 0) {
			expect(inp[0].name).toBe('webvitals')
		}

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('webvitals span inherits documentLoad startTime and URL even after SPA navigation', async ({
		browserName,
		recordPage,
	}) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		const docLoadUrl = 'http://localhost:3000/webvitals/webvitals.ejs'

		await recordPage.goTo('/webvitals/webvitals.ejs')

		await recordPage.evaluate(() => {
			history.pushState({}, '', '/spa-navigated-away')
		})

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const docLoadSpan = recordPage.receivedSpans.find((span) => span.name === 'documentLoad')
		const webvitalsSpan = recordPage.receivedSpans.find((span) => span.tags.lcp !== undefined)

		expectDefined(docLoadSpan)
		expectDefined(webvitalsSpan)

		expect(webvitalsSpan.timestamp).toBe(docLoadSpan?.timestamp + 1000)
		expect(webvitalsSpan.tags['location.href']).toBe(docLoadUrl)
	})

	test('webvitals - attribution attributes are NOT emitted by default', async ({ browserName, recordPage }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals.ejs')

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const webvitalsSpans = recordPage.receivedSpans.filter((span) => span.name === 'webvitals')
		expect(webvitalsSpans.length).toBeGreaterThan(0)

		for (const span of webvitalsSpans) {
			expect(span.tags['webvitals.name']).toBeUndefined()
			expect(span.tags['webvitals.rating']).toBeUndefined()
			expect(span.tags['webvitals.navigation_type']).toBeUndefined()
		}

		const fcp = recordPage.receivedSpans.filter((span) => span.tags.fcp !== undefined)
		const ttfb = recordPage.receivedSpans.filter((span) => span.tags.ttfb !== undefined)
		expect(fcp).toHaveLength(0)
		expect(ttfb).toHaveLength(0)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('webvitals - attribution attributes are emitted when _experimental_attribution is enabled', async ({
		browserName,
		recordPage,
	}) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals-attribution.ejs')

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const lcpSpan = recordPage.receivedSpans.find((span) => span.tags.lcp !== undefined)
		expectDefined(lcpSpan)
		expect(lcpSpan.name).toBe('webvitals')
		expect(lcpSpan.tags['webvitals.name']).toBe('LCP')
		expect(lcpSpan.tags['webvitals.rating']).toBeDefined()
		expect(lcpSpan.tags['webvitals.navigation_type']).toBeDefined()
		expect(lcpSpan.tags['lcp.element_render_delay']).toBeDefined()
		expect(lcpSpan.tags['lcp.resource_load_delay']).toBeDefined()
		expect(lcpSpan.tags['lcp.resource_load_duration']).toBeDefined()
		expect(lcpSpan.tags['lcp.time_to_first_byte']).toBeDefined()
		expect(lcpSpan.tags['lcp.target']).toBeDefined()
		expect(lcpSpan.tags['lcp.url']).toBeDefined()

		const clsSpan = recordPage.receivedSpans.find((span) => span.tags.cls !== undefined)
		expectDefined(clsSpan)
		expect(clsSpan.name).toBe('webvitals')
		expect(clsSpan.tags['webvitals.name']).toBe('CLS')
		expect(clsSpan.tags['cls.largest_shift_target']).toBeDefined()
		expect(clsSpan.tags['cls.largest_shift_time']).toBeDefined()
		expect(clsSpan.tags['cls.largest_shift_value']).toBeDefined()
		expect(clsSpan.tags['cls.load_state']).toBeDefined()

		const inpSpan = recordPage.receivedSpans.find((span) => span.tags.inp !== undefined)
		if (inpSpan) {
			expect(inpSpan.name).toBe('webvitals')
			expect(inpSpan.tags['webvitals.name']).toBe('INP')
			expect(inpSpan.tags['inp.input_delay']).toBeDefined()
			expect(inpSpan.tags['inp.processing_duration']).toBeDefined()
			expect(inpSpan.tags['inp.presentation_delay']).toBeDefined()
			expect(inpSpan.tags['inp.interaction_target']).toBeDefined()
			expect(inpSpan.tags['inp.interaction_type']).toBeDefined()
			expect(inpSpan.tags['inp.load_state']).toBeDefined()
		}

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('webvitals - FCP and TTFB spans are emitted when _experimental_fcp / _experimental_ttfb are enabled', async ({
		browserName,
		recordPage,
	}) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals-additional-metrics.ejs')

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const fcpSpan = recordPage.receivedSpans.find((span) => span.tags.fcp !== undefined)
		expectDefined(fcpSpan)
		expect(fcpSpan.name).toBe('webvitals')
		expect(fcpSpan.tags['webvitals.name']).toBe('FCP')
		expect(fcpSpan.tags['fcp.first_byte_to_fcp']).toBeDefined()
		expect(fcpSpan.tags['fcp.time_to_first_byte']).toBeDefined()
		expect(fcpSpan.tags['fcp.load_state']).toBeDefined()

		const ttfbSpan = recordPage.receivedSpans.find((span) => span.tags.ttfb !== undefined)
		expectDefined(ttfbSpan)
		expect(ttfbSpan.name).toBe('webvitals')
		expect(ttfbSpan.tags['webvitals.name']).toBe('TTFB')
		expect(ttfbSpan.tags['ttfb.cache_duration']).toBeDefined()
		expect(ttfbSpan.tags['ttfb.connection_duration']).toBeDefined()
		expect(ttfbSpan.tags['ttfb.dns_duration']).toBeDefined()
		expect(ttfbSpan.tags['ttfb.request_duration']).toBeDefined()
		expect(ttfbSpan.tags['ttfb.waiting_duration']).toBeDefined()

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('webvitals - specific metrics disabled', async ({ browserName, recordPage }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals-specific-disabled.ejs')

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		// webvitals library won't send the cls unless a visibility change happens, so
		// force a fake one
		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const lcp = recordPage.receivedSpans.filter((span) => span.tags.lcp !== undefined)
		const cls = recordPage.receivedSpans.filter((span) => span.tags.cls !== undefined)

		expect(lcp).toHaveLength(0)
		expect(cls).toHaveLength(0)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
