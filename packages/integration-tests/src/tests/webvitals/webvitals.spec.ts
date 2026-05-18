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

import { RecordPage } from '../../pages/record-page'
import { expectDefined, test } from '../../utils/test'

const ATTRIBUTION_TAGS = [
	'cls.largest_shift_source.current_rect.height',
	'cls.largest_shift_source.current_rect.width',
	'cls.largest_shift_source.current_rect.x',
	'cls.largest_shift_source.current_rect.y',
	'cls.largest_shift_source.previous_rect.height',
	'cls.largest_shift_source.previous_rect.width',
	'cls.largest_shift_source.previous_rect.x',
	'cls.largest_shift_source.previous_rect.y',
	'cls.largest_shift_target',
	'cls.largest_shift_time',
	'cls.largest_shift_value',
	'cls.load_state',
	'fcp.first_byte_to_fcp',
	'fcp.load_state',
	'fcp.time_to_first_byte',
	'http.response.body.size',
	'http.response.body.uncompressed_size',
	'http.response.status_code',
	'inp.input_delay',
	'inp.interaction_target',
	'inp.interaction_time',
	'inp.interaction_type',
	'inp.load_state',
	'inp.next_paint_time',
	'inp.presentation_delay',
	'inp.processing_duration',
	'lcp.element_render_delay',
	'lcp.resource_load_delay',
	'lcp.resource_load_duration',
	'lcp.resource.initiator_type',
	'lcp.resource.transfer_size',
	'lcp.target',
	'lcp.time_to_first_byte',
	'lcp.url',
	'network.protocol.name',
	'ttfb.cache_duration',
	'ttfb.connection_duration',
	'ttfb.dns_duration',
	'ttfb.request_duration',
	'ttfb.waiting_duration',
] as const

const expectNumericTag = (tags: Record<string, unknown>, name: string): void => {
	expect(tags[name]).toBeDefined()
	expect(Number.isFinite(Number.parseFloat(String(tags[name])))).toBeTruthy()
}

const expectStringTag = (tags: Record<string, unknown>, name: string): void => {
	expect(typeof tags[name]).toBe('string')
}

const expectNoLegacyAttributionTags = (tags: Record<string, unknown>): void => {
	expect(Object.keys(tags).some((name) => name.includes('.attribution.'))).toBeFalsy()
}

const expectNoAttributionTags = (tags: Record<string, unknown>): void => {
	expectNoLegacyAttributionTags(tags)
	for (const name of ATTRIBUTION_TAGS) {
		expect(tags[name], `${name} should not be emitted`).toBeUndefined()
	}
}

const expectSafeTarget = (target: unknown): void => {
	if (target === undefined) {
		return
	}

	expect(typeof target).toBe('string')
	expect(target).not.toContain('#clicky')
	expect(target).not.toContain('#shift')
}

const waitForTwoAnimationFrames = (): Promise<void> =>
	new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				resolve()
			})
		})
	})

async function collectWebVitals(recordPage: RecordPage, url: string): Promise<void> {
	await recordPage.goTo(url)
	await expect(recordPage.locator('#shift')).toBeAttached()
	await recordPage.evaluate(waitForTwoAnimationFrames)

	await recordPage.locator('#clicky').click()
	await expect(recordPage.locator('#p2')).toBeAttached()

	// webvitals library won't send the cls unless a visibility change happens, so
	// force a fake one
	await recordPage.changeVisibilityInTab('hidden')
	await recordPage.waitForTimeoutAndFlushData(1000)
}

function getMetricSpans(recordPage: RecordPage, name: string) {
	return recordPage.receivedSpans.filter((span) => span.tags[name] !== undefined)
}

function expectSingleMetricSpan(recordPage: RecordPage, name: string) {
	const spans = getMetricSpans(recordPage, name)
	expect(spans).toHaveLength(1)
	const span = spans[0]
	expectDefined(span)
	expect(span.name).toBe('webvitals')
	expectNumericTag(span.tags, name)
	expectStringTag(span.tags, 'webvitals.metric_id')
	expectNumericTag(span.tags, 'webvitals.delta')
	expectStringTag(span.tags, 'webvitals.navigation_type')
	return span
}

test.describe('web vitals', () => {
	test('web vitals spans', async ({ browserName, recordPage }) => {
		// TODO: Investigate why this test is disabled on webkit and firefox
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await collectWebVitals(recordPage, '/webvitals/webvitals.ejs')

		const lcp = expectSingleMetricSpan(recordPage, 'lcp')
		expectNoAttributionTags(lcp.tags)

		const cls = expectSingleMetricSpan(recordPage, 'cls')
		expectNoAttributionTags(cls.tags)

		const inp = expectSingleMetricSpan(recordPage, 'inp')
		expectNoAttributionTags(inp.tags)

		expect(getMetricSpans(recordPage, 'fcp')).toHaveLength(0)
		expect(getMetricSpans(recordPage, 'ttfb')).toHaveLength(0)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('web vitals attribution attributes require experimental attribution', async ({ browserName, recordPage }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await collectWebVitals(recordPage, '/webvitals/webvitals-attribution.ejs')

		const lcp = expectSingleMetricSpan(recordPage, 'lcp')
		expectNoLegacyAttributionTags(lcp.tags)
		expectSafeTarget(lcp.tags['lcp.target'])
		expectNumericTag(lcp.tags, 'lcp.time_to_first_byte')
		expectNumericTag(lcp.tags, 'lcp.resource_load_delay')
		expectNumericTag(lcp.tags, 'lcp.resource_load_duration')
		expectNumericTag(lcp.tags, 'lcp.element_render_delay')

		const cls = expectSingleMetricSpan(recordPage, 'cls')
		expectNoLegacyAttributionTags(cls.tags)
		expectSafeTarget(cls.tags['cls.largest_shift_target'])
		expectNumericTag(cls.tags, 'cls.largest_shift_time')
		expectNumericTag(cls.tags, 'cls.largest_shift_value')
		expectStringTag(cls.tags, 'cls.load_state')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.previous_rect.x')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.previous_rect.y')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.previous_rect.width')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.previous_rect.height')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.current_rect.x')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.current_rect.y')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.current_rect.width')
		expectNumericTag(cls.tags, 'cls.largest_shift_source.current_rect.height')

		const inp = expectSingleMetricSpan(recordPage, 'inp')
		expectNoLegacyAttributionTags(inp.tags)
		expectSafeTarget(inp.tags['inp.interaction_target'])
		expectNumericTag(inp.tags, 'inp.interaction_time')
		expectStringTag(inp.tags, 'inp.interaction_type')
		expectNumericTag(inp.tags, 'inp.next_paint_time')
		expectNumericTag(inp.tags, 'inp.input_delay')
		expectNumericTag(inp.tags, 'inp.processing_duration')
		expectNumericTag(inp.tags, 'inp.presentation_delay')
		expectStringTag(inp.tags, 'inp.load_state')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('experimental FCP and TTFB emit only when opted in without attribution by default', async ({
		browserName,
		recordPage,
	}) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await collectWebVitals(recordPage, '/webvitals/webvitals-experimental.ejs')

		const fcp = expectSingleMetricSpan(recordPage, 'fcp')
		expectNoAttributionTags(fcp.tags)

		const ttfb = expectSingleMetricSpan(recordPage, 'ttfb')
		expectNoAttributionTags(ttfb.tags)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('experimental FCP and TTFB attribution requires experimental attribution', async ({
		browserName,
		recordPage,
	}) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await collectWebVitals(recordPage, '/webvitals/webvitals-experimental-attribution.ejs')

		const fcp = expectSingleMetricSpan(recordPage, 'fcp')
		expectNoLegacyAttributionTags(fcp.tags)
		expectNumericTag(fcp.tags, 'fcp.time_to_first_byte')
		expectNumericTag(fcp.tags, 'fcp.first_byte_to_fcp')
		expectStringTag(fcp.tags, 'fcp.load_state')

		const ttfb = expectSingleMetricSpan(recordPage, 'ttfb')
		expectNoLegacyAttributionTags(ttfb.tags)
		expectNumericTag(ttfb.tags, 'ttfb.waiting_duration')
		expectNumericTag(ttfb.tags, 'ttfb.cache_duration')
		expectNumericTag(ttfb.tags, 'ttfb.dns_duration')
		expectNumericTag(ttfb.tags, 'ttfb.connection_duration')
		expectNumericTag(ttfb.tags, 'ttfb.request_duration')

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
		await expect(recordPage.locator('#shift')).toBeAttached()
		await recordPage.evaluate(waitForTwoAnimationFrames)

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
		expect(
			recordPage.receivedSpans.some(
				(span) =>
					span.tags['lcp.target'] !== undefined ||
					span.tags['cls.largest_shift_target'] !== undefined ||
					Object.keys(span.tags).some((name) => name.includes('.attribution.')),
			),
		).toBeFalsy()

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
