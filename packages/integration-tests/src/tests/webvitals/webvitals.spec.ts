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
import type { ExportedTestSpan } from '@test-utils/test-span.js'

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
	'inp.longest_script_intersecting_duration',
	'inp.longest_script_subpart',
	'inp.next_paint_time',
	'inp.presentation_delay',
	'inp.processing_duration',
	'inp.total_paint_duration',
	'inp.total_script_duration',
	'inp.total_style_and_layout_duration',
	'inp.total_unattributed_duration',
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

const SHARED_WEBVITALS_TAGS = ['webvitals.delta', 'webvitals.metric_id', 'webvitals.navigation_type'] as const

const expectNumericTag = (span: ExportedTestSpan, name: string): void => {
	const value = span.attributes[name]
	expect(value, `expected attribute "${name}" to be defined`).toBeDefined()
	expect(Number.isFinite(Number.parseFloat(String(value))), `expected attribute "${name}" to be numeric`).toBeTruthy()
}

const expectStringTag = (span: ExportedTestSpan, name: string): void => {
	expect(typeof span.attributes[name], `expected attribute "${name}" to be a string`).toBe('string')
}

const expectNoLegacyAttributionTags = (span: ExportedTestSpan): void => {
	const hasLegacy = Object.keys(span.attributes).some((key) => key.includes('.attribution.'))
	expect(hasLegacy).toBeFalsy()
}

const expectNoAttributionTags = (span: ExportedTestSpan): void => {
	expectNoLegacyAttributionTags(span)
	for (const name of ATTRIBUTION_TAGS) {
		expect(span.attributes[name], `${name} should not be emitted`).toBeUndefined()
	}

	for (const name of SHARED_WEBVITALS_TAGS) {
		expect(span.attributes[name], `${name} should not be emitted`).toBeUndefined()
	}
}

const expectSharedWebVitalsTags = (span: ExportedTestSpan): void => {
	expectStringTag(span, 'webvitals.metric_id')
	expectNumericTag(span, 'webvitals.delta')
	expectStringTag(span, 'webvitals.navigation_type')
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

function hrTimeToNanos(span: ExportedTestSpan): bigint {
	return BigInt(span.startTime[0]) * 1_000_000_000n + BigInt(span.startTime[1])
}

function getMetricSpans(recordPage: RecordPage, name: string) {
	return recordPage.receivedSpans.filter((span) => span.attributes[name] !== undefined)
}

function expectSingleMetricSpan(recordPage: RecordPage, name: string) {
	const spans = getMetricSpans(recordPage, name)
	expect(spans).toHaveLength(1)
	const span = spans[0]
	expectDefined(span)
	expect(span.name).toBe('webvitals')
	expectNumericTag(span, name)
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
		expectNoAttributionTags(lcp)

		const cls = expectSingleMetricSpan(recordPage, 'cls')
		expectNoAttributionTags(cls)

		const inp = expectSingleMetricSpan(recordPage, 'inp')
		expectNoAttributionTags(inp)

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
		expectNoLegacyAttributionTags(lcp)
		expectSharedWebVitalsTags(lcp)
		expectSafeTarget(lcp.attributes['lcp.target'])
		expectNumericTag(lcp, 'lcp.time_to_first_byte')
		expectNumericTag(lcp, 'lcp.resource_load_delay')
		expectNumericTag(lcp, 'lcp.resource_load_duration')
		expectNumericTag(lcp, 'lcp.element_render_delay')

		const cls = expectSingleMetricSpan(recordPage, 'cls')
		expectNoLegacyAttributionTags(cls)
		expectSharedWebVitalsTags(cls)
		expectSafeTarget(cls.attributes['cls.largest_shift_target'])
		expectNumericTag(cls, 'cls.largest_shift_time')
		expectNumericTag(cls, 'cls.largest_shift_value')
		expectStringTag(cls, 'cls.load_state')
		expectNumericTag(cls, 'cls.largest_shift_source.previous_rect.x')
		expectNumericTag(cls, 'cls.largest_shift_source.previous_rect.y')
		expectNumericTag(cls, 'cls.largest_shift_source.previous_rect.width')
		expectNumericTag(cls, 'cls.largest_shift_source.previous_rect.height')
		expectNumericTag(cls, 'cls.largest_shift_source.current_rect.x')
		expectNumericTag(cls, 'cls.largest_shift_source.current_rect.y')
		expectNumericTag(cls, 'cls.largest_shift_source.current_rect.width')
		expectNumericTag(cls, 'cls.largest_shift_source.current_rect.height')

		const inp = expectSingleMetricSpan(recordPage, 'inp')
		expectNoLegacyAttributionTags(inp)
		expectSharedWebVitalsTags(inp)
		expectSafeTarget(inp.attributes['inp.interaction_target'])
		expectNumericTag(inp, 'inp.interaction_time')
		expectStringTag(inp, 'inp.interaction_type')
		expectNumericTag(inp, 'inp.next_paint_time')
		expectNumericTag(inp, 'inp.input_delay')
		expectNumericTag(inp, 'inp.processing_duration')
		expectNumericTag(inp, 'inp.presentation_delay')
		expectStringTag(inp, 'inp.load_state')

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
		expectNoAttributionTags(fcp)

		const ttfb = expectSingleMetricSpan(recordPage, 'ttfb')
		expectNoAttributionTags(ttfb)

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
		expectNoLegacyAttributionTags(fcp)
		expectSharedWebVitalsTags(fcp)
		expectNumericTag(fcp, 'fcp.time_to_first_byte')
		expectNumericTag(fcp, 'fcp.first_byte_to_fcp')
		expectStringTag(fcp, 'fcp.load_state')

		const ttfb = expectSingleMetricSpan(recordPage, 'ttfb')
		expectNoLegacyAttributionTags(ttfb)
		expectSharedWebVitalsTags(ttfb)
		expectNumericTag(ttfb, 'ttfb.waiting_duration')
		expectNumericTag(ttfb, 'ttfb.cache_duration')
		expectNumericTag(ttfb, 'ttfb.dns_duration')
		expectNumericTag(ttfb, 'ttfb.connection_duration')
		expectNumericTag(ttfb, 'ttfb.request_duration')

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
		const webvitalsSpan = recordPage.receivedSpans.find((span) => span.attributes['lcp'] !== undefined)

		expectDefined(docLoadSpan)
		expectDefined(webvitalsSpan)

		expect(hrTimeToNanos(webvitalsSpan)).toBe(hrTimeToNanos(docLoadSpan) + 1_000_000n)
		expect(webvitalsSpan.attributes['location.href']).toBe(docLoadUrl)
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

		const lcp = recordPage.receivedSpans.filter((span) => span.attributes['lcp'] !== undefined)
		const cls = recordPage.receivedSpans.filter((span) => span.attributes['cls'] !== undefined)

		expect(lcp).toHaveLength(0)
		expect(cls).toHaveLength(0)
		expect(
			recordPage.receivedSpans.some(
				(span) =>
					span.attributes['lcp.target'] !== undefined ||
					span.attributes['cls.largest_shift_target'] !== undefined ||
					Object.keys(span.attributes).some((key) => key.includes('.attribution.')),
			),
		).toBeFalsy()

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
