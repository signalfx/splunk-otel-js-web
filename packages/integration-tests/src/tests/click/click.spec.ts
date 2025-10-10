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
import { expect } from '@playwright/test'

import { test } from '../../utils/test'

const path = '/click/click.ejs'
test.describe('Click', () => {
	test('click in webkit works after calling addEventListener("click")', async ({ browserName, recordPage }) => {
		if (browserName !== 'webkit') {
			return
		}

		await recordPage.goTo(path)

		await recordPage.evaluate(() => {
			document.body.addEventListener('click', () => {})
		})

		await recordPage.locator('h1').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.tags['event_type'] === 'click'))

		const clickSpans = recordPage.receivedSpans.filter((span) => span.tags['event_type'] === 'click')
		expect(clickSpans).toHaveLength(1)
	})
	test('click in webkit is not recorded without addEventListener call', async ({ browserName, recordPage }) => {
		if (browserName !== 'webkit') {
			return
		}

		await recordPage.goTo(path)

		await recordPage.locator('h1').click()

		await recordPage.waitForTimeout(1000)

		const clickSpans = recordPage.receivedSpans.filter((span) => span.tags['event_type'] === 'click')
		expect(clickSpans).toHaveLength(0)
	})
	test('click in webkit is not recorded after calling addEventListener("scroll")', async ({
		browserName,
		recordPage,
	}) => {
		if (browserName !== 'webkit') {
			return
		}

		await recordPage.goTo(path)

		await recordPage.evaluate(() => {
			document.body.addEventListener('scroll', () => {})
		})

		await recordPage.locator('h1').click()

		await recordPage.waitForTimeout(1000)

		const clickSpans = recordPage.receivedSpans.filter((span) => span.tags['event_type'] === 'click')
		expect(clickSpans).toHaveLength(0)
	})
})
