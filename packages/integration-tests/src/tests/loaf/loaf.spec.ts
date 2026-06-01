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

import { MAX_LOAF_SCRIPT_SUMMARIES } from '../../../../web/src/instrumentations/loaf/constants'
import { isLongAnimationFrameSupported } from '../../../../web/src/instrumentations/loaf/support'
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
		const attributes = loafSpan.attributes
		expect(loafSpan).toHaveSpanAttribute('component', 'splunk-loaf')
		expect(loafSpan).toHaveSpanAttribute('loaf.name', LOAF_SPAN_NAME)
		expect(loafSpan).toHaveSpanAttribute('loaf.entry_type', LOAF_SPAN_NAME)
		expect(loafSpan).toHaveNumericAttribute('loaf.duration')
		expect(loafSpan).toHaveNumericAttribute('loaf.blocking_duration')
		expect(loafSpan).toHaveNumericAttribute('loaf.render_start')
		expect(loafSpan).toHaveNumericAttribute('loaf.style_and_layout_start')
		expect(loafSpan).toHaveNumericAttribute('loaf.first_ui_event_timestamp')
		expect(loafSpan).toHaveNumericAttribute('loaf.script_count')

		const scriptCount = Number.parseFloat(String(attributes['loaf.script_count']))
		expect(scriptCount).toBeGreaterThan(0)
		const exportedScriptIndexes = getExportedScriptIndexes(attributes, scriptCount)
		expect(exportedScriptIndexes.length).toBeGreaterThan(0)
		expect(exportedScriptIndexes.length).toBeLessThanOrEqual(MAX_LOAF_SCRIPT_SUMMARIES)

		for (const index of exportedScriptIndexes) {
			expect(loafSpan).toHaveNumericAttribute(`loaf.script[${index}].duration`)
			expect(loafSpan).toHaveNumericAttribute(`loaf.script[${index}].execution_start`)
			expect(loafSpan).toHaveNumericAttribute(`loaf.script[${index}].forced_style_and_layout_duration`)
			expect(loafSpan).toHaveStringAttribute(`loaf.script[${index}].invoker`)
			expect(loafSpan).toHaveStringAttribute(`loaf.script[${index}].invoker_type`)
			expect(loafSpan).toHaveNumericAttribute(`loaf.script[${index}].pause_duration`)
			expect(loafSpan).toHaveNumericAttribute(`loaf.script[${index}].source_char_position`)
			expect(loafSpan).toHaveStringAttribute(`loaf.script[${index}].source_url`)
			expect(loafSpan).toHaveStringAttribute(`loaf.script[${index}].source_function_name`)
			expect(loafSpan).toHaveNumericAttribute(`loaf.script[${index}].start_time`)
		}

		expect(attributes[`loaf.script[${MAX_LOAF_SCRIPT_SUMMARIES}].duration`]).toBeUndefined()
	})

	test('reports buffered LoAF entries', async ({ browserName, recordPage }) => {
		await skipIfLoafUnsupported(browserName, recordPage)

		await recordPage.goTo('/loaf/buffered.ejs')
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === LOAF_SPAN_NAME))

		const loafSpan = getLoafSpans(recordPage)[0]
		const duration = Number.parseFloat(String(loafSpan.attributes['loaf.duration']))
		expect(duration).toBeGreaterThanOrEqual(50)
		expect(hrTimeToMicroseconds(loafSpan.duration)).toBeCloseTo(duration * 1000, 0)
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

	const supportedEntryTypes = await recordPage.evaluate(() => window.PerformanceObserver?.supportedEntryTypes ?? [])
	if (!isLongAnimationFrameSupported(supportedEntryTypes)) {
		test.skip()
	}
}

function getLoafSpans(recordPage: RecordPage) {
	return recordPage.receivedSpans.filter((span) => span.name === LOAF_SPAN_NAME)
}

function getExportedScriptIndexes(attributes: Record<string, unknown>, scriptCount: number): number[] {
	return Array.from({ length: scriptCount }, (_, index) => index).filter(
		(index) => attributes[`loaf.script[${index}].duration`] !== undefined,
	)
}
