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
import { test } from '../../utils/test'

const LOAF_SPAN_NAME = 'long-animation-frame'

test.describe('long animation frame', () => {
	test('reports a LoAF span with bounded script attribution', async ({ browserName, recordPage }) => {
		await skipIfLoafUnsupported(browserName, recordPage)

		await recordPage.goTo('/loaf/index.ejs')
		await recordPage.locator('#btnLoaf').click()
		await recordPage.waitForTestToFinish()
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === LOAF_SPAN_NAME))

		const loafSpan = getLoafSpans(recordPage)[0]
		const tags = loafSpan.tags
		expect(tags['component']).toBe('splunk-loaf')
		expect(tags['loaf.name']).toBe(LOAF_SPAN_NAME)
		expect(tags['loaf.entry_type']).toBe(LOAF_SPAN_NAME)
		expectNumericTag(tags, 'loaf.duration')
		expectNumericTag(tags, 'loaf.blocking_duration')
		expectNumericTag(tags, 'loaf.render_start')
		expectNumericTag(tags, 'loaf.style_and_layout_start')
		expectNumericTag(tags, 'loaf.first_ui_event_timestamp')
		expectNumericTag(tags, 'loaf.script_count')

		const scriptCount = Number.parseFloat(String(tags['loaf.script_count']))
		expect(scriptCount).toBeGreaterThan(0)
		for (let index = 0; index < Math.min(scriptCount, 3); index += 1) {
			expectNumericTag(tags, `loaf.script[${index}].duration`)
			expectStringTag(tags, `loaf.script[${index}].invoker`)
			expectStringTag(tags, `loaf.script[${index}].invoker_type`)
			expectStringTag(tags, `loaf.script[${index}].source_url`)
			expectStringTag(tags, `loaf.script[${index}].source_function_name`)
			expectNumericTag(tags, `loaf.script[${index}].forced_style_and_layout_duration`)
		}

		expect(tags['loaf.script[3].duration']).toBeUndefined()
	})

	test('reports buffered LoAF entries', async ({ browserName, recordPage }) => {
		await skipIfLoafUnsupported(browserName, recordPage)

		await recordPage.goTo('/loaf/buffered.ejs')
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === LOAF_SPAN_NAME))

		const loafSpan = getLoafSpans(recordPage)[0]
		const duration = Number.parseFloat(String(loafSpan.tags['loaf.duration']))
		expect(duration).toBeGreaterThanOrEqual(50)
		expect(loafSpan.duration).toBeCloseTo(duration * 1000, 0)
	})

	test('does not report longtask when LoAF is enabled and supported', async ({ browserName, recordPage }) => {
		await skipIfLoafUnsupported(browserName, recordPage)

		await recordPage.goTo('/loaf/index.ejs')
		await recordPage.locator('#btnLoaf').click()
		await recordPage.waitForTestToFinish()
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === LOAF_SPAN_NAME))
		await recordPage.waitForTimeoutAndFlushData(1000)

		expect(recordPage.receivedSpans.filter((span) => span.name === 'longtask')).toHaveLength(0)
	})

	test('preserves longtask behavior when LoAF is disabled', async ({ browserName, recordPage }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/long-task/index.ejs')
		await recordPage.locator('#btnLongtask').click()
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'longtask'))

		expect(recordPage.receivedSpans.filter((span) => span.name === 'longtask').length).toBeGreaterThanOrEqual(1)
	})
})

async function skipIfLoafUnsupported(browserName: string, recordPage: RecordPage): Promise<void> {
	if (browserName === 'webkit' || browserName === 'firefox') {
		test.skip()
	}

	const isSupported = await recordPage.evaluate(
		() => window.PerformanceObserver?.supportedEntryTypes?.includes('long-animation-frame') ?? false,
	)
	if (!isSupported) {
		test.skip()
	}
}

function getLoafSpans(recordPage: RecordPage) {
	return recordPage.receivedSpans.filter((span) => span.name === LOAF_SPAN_NAME)
}

function expectNumericTag(tags: Record<string, unknown>, name: string): void {
	expect(tags[name]).toBeDefined()
	expect(Number.isFinite(Number.parseFloat(String(tags[name])))).toBeTruthy()
}

function expectStringTag(tags: Record<string, unknown>, name: string): void {
	expect(typeof tags[name]).toBe('string')
}
