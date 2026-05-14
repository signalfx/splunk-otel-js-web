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

test.describe('long task', () => {
	test('reports a long task', async ({ browserName, recordPage }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/long-task/index.ejs')

		await recordPage.locator('#btnLongtask').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'longtask'))
		const longTaskSpans = recordPage.receivedSpans.filter((span) => span.name === 'longtask')

		// Browser may report additional longtasks from page initialization alongside the click-triggered one
		expect(longTaskSpans.length).toBeGreaterThanOrEqual(1)

		for (const span of longTaskSpans) {
			expect(span.tags['component']).toBe('splunk-longtask')
			expect(['self', 'unknown'].includes(span.tags['longtask.name'] as string)).toBeTruthy()
			expect(span.tags['longtask.entry_type']).toBe('longtask')
			expect(span.tags['longtask.attribution.name']).toBe('unknown')
			expect(span.tags['longtask.attribution.entry_type']).toBe('taskattribution')
			expect(span.tags['longtask.attribution.start_time']).toBe('0')
			expect(span.tags['longtask.attribution.duration']).toBe('0')
			expect(span.tags['longtask.attribution.container_type']).toBe('window')
			expect(span.tags['longtask.attribution.container_src']).toBe('')
			expect(span.tags['longtask.attribution.container_id']).toBe('')
			expect(span.tags['longtask.attribution.container_name']).toBe('')

			const longTaskSpanDuration = Number.parseFloat(span.tags['longtask.duration'] as string)
			// Long Tasks API spec defines 50ms as the minimum threshold, so exactly 50 is valid
			expect(
				longTaskSpanDuration,
				`Duration (${longTaskSpanDuration}) must be at least 50ms by definition.`,
			).toBeGreaterThanOrEqual(50)
			expect(
				longTaskSpanDuration,
				`Duration (${longTaskSpanDuration}) must be less than 1s by definition.`,
			).toBeLessThan(1000)

			expect(span.duration, 'Span duration matches longtask duration').toBe(longTaskSpanDuration * 1000)
		}

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('reports buffered longtask', async ({ browserName, recordPage }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/long-task/buffered.ejs')
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'longtask'))
		const longTaskSpans = recordPage.receivedSpans.filter((span) => span.name === 'longtask')

		// Browser initialization may produce additional longtasks beyond the one explicitly generated in buffered.ejs
		expect(longTaskSpans.length).toBeGreaterThanOrEqual(1)
		const longTaskSpanDuration = Number.parseFloat(longTaskSpans[0].tags['longtask.duration'] as string)
		expect(longTaskSpans[0].duration, 'Span duration matches longtask duration').toBe(longTaskSpanDuration * 1000)
	})

	test('can be disabled', async ({ browserName, recordPage }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/long-task/index.ejs?disableInstrumentation=longtask')
		await recordPage.locator('#btnLongtask').click()

		await recordPage.waitForTimeoutAndFlushData(1000)

		const longTaskSpans = recordPage.receivedSpans.filter((span) => span.name === 'longtask')

		expect(longTaskSpans).toHaveLength(0)
	})
})
