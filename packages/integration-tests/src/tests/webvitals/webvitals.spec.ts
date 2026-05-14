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

test.describe('web vitals', () => {
	test('web vitals spans', async ({ browserName, recordPage }) => {
		// TODO: Investigate why this test is disabled on webkit and firefox
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals.ejs')
		await expect(recordPage.locator('#shift')).toBeAttached()
		await recordPage.evaluate(waitForTwoAnimationFrames)

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		// webvitals library won't send the cls unless a visibility change happens, so
		// force a fake one
		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const lcp = recordPage.receivedSpans.filter((span) => span.tags.lcp !== undefined)
		expect(lcp).toHaveLength(1)
		expect(lcp[0].name).toBe('webvitals')
		expectNoLegacyAttributionTags(lcp[0].tags)
		expectStringTag(lcp[0].tags, 'webvitals.metric_id')
		expectNumericTag(lcp[0].tags, 'webvitals.delta')
		expectStringTag(lcp[0].tags, 'webvitals.navigation_type')
		expectSafeTarget(lcp[0].tags['lcp.target'])
		expectNumericTag(lcp[0].tags, 'lcp.time_to_first_byte')
		expectNumericTag(lcp[0].tags, 'lcp.resource_load_delay')
		expectNumericTag(lcp[0].tags, 'lcp.resource_load_duration')
		expectNumericTag(lcp[0].tags, 'lcp.element_render_delay')

		const cls = recordPage.receivedSpans.filter((span) => span.tags.cls !== undefined)
		expect(cls).toHaveLength(1)
		expect(cls[0].name).toBe('webvitals')
		expectNoLegacyAttributionTags(cls[0].tags)
		expectStringTag(cls[0].tags, 'webvitals.metric_id')
		expectNumericTag(cls[0].tags, 'webvitals.delta')
		expectStringTag(cls[0].tags, 'webvitals.navigation_type')
		expectSafeTarget(cls[0].tags['cls.largest_shift_target'])
		expectNumericTag(cls[0].tags, 'cls.largest_shift_time')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_value')
		expectStringTag(cls[0].tags, 'cls.load_state')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.previous_rect.x')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.previous_rect.y')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.previous_rect.width')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.previous_rect.height')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.current_rect.x')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.current_rect.y')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.current_rect.width')
		expectNumericTag(cls[0].tags, 'cls.largest_shift_source.current_rect.height')

		const inp = recordPage.receivedSpans.filter((span) => span.tags.inp !== undefined)
		expect(inp).toHaveLength(1)
		expect(inp[0].name).toBe('webvitals')
		expectNoLegacyAttributionTags(inp[0].tags)
		expectStringTag(inp[0].tags, 'webvitals.metric_id')
		expectNumericTag(inp[0].tags, 'webvitals.delta')
		expectStringTag(inp[0].tags, 'webvitals.navigation_type')
		expectSafeTarget(inp[0].tags['inp.interaction_target'])
		expectNumericTag(inp[0].tags, 'inp.interaction_time')
		expectStringTag(inp[0].tags, 'inp.interaction_type')
		expectNumericTag(inp[0].tags, 'inp.next_paint_time')
		expectNumericTag(inp[0].tags, 'inp.input_delay')
		expectNumericTag(inp[0].tags, 'inp.processing_duration')
		expectNumericTag(inp[0].tags, 'inp.presentation_delay')
		expectStringTag(inp[0].tags, 'inp.load_state')

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
