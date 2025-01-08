/**
 *
 * Copyright 2020-2025 Splunk Inc.
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
import { test } from '../../utils/test'
import { expect } from '@playwright/test'

test.describe('causality', () => {
	test('handles causality of a mouse click', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/causality.ejs')

		await recordPage.locator('body').click()
		await recordPage.locator('#btn1').click()

		await recordPage.waitForSpans(
			(spans) =>
				spans.filter((span) => span.name === 'click' && span.tags['target_xpath'] === '//*[@id="btn1"]')
					.length === 1 &&
				spans.filter((span) => span.tags['http.url'] === 'http://localhost:3000/some-data').length === 1,
		)

		const clickSpans = recordPage.receivedSpans.filter(
			(span) => span.name === 'click' && span.tags['target_xpath'] === '//*[@id="btn1"]',
		)
		const fetchSpans = recordPage.receivedSpans.filter(
			(span) => span.tags['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(clickSpans).toHaveLength(1)
		expect(fetchSpans).toHaveLength(1)
		expect(fetchSpans[0].parentId).toBe(clickSpans[0].id)
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('can be disabled', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/causality.ejs?disableInstrumentation=interactions')

		await recordPage.locator('body').click()
		await recordPage.locator('#btn1').click()

		await recordPage.waitForTimeoutAndFlushData(1000)

		const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')

		expect(clickSpans).toHaveLength(0)
	})
})
