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

test.describe('Frustration signals', () => {
	test('Rage clicks disabled', async ({ recordPage }) => {
		await recordPage.goTo('/frustration-signals/rage-click-disabled.ejs')
		await makeClicks(recordPage)

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'click').length === 8)

		expect(
			recordPage.receivedSpans.filter(
				(span) =>
					span.name === 'frustration' &&
					span.tags['frustration_type'] === 'rage' &&
					span.tags['interaction_type'] === 'click',
			),
		).toHaveLength(0)
		expect(recordPage.receivedSpans.filter(({ name }) => name === 'click')).toHaveLength(8)
	})

	test('Rage clicks default settings', async ({ recordPage }) => {
		await recordPage.goTo('/frustration-signals/rage-click.ejs')
		await makeClicks(recordPage)

		await recordPage.waitForSpans((spans) =>
			spans.some(
				(span) =>
					span.name === 'frustration' &&
					span.tags['frustration_type'] === 'rage' &&
					span.tags['interaction_type'] === 'click' &&
					span.tags['target_xpath'] === '//html/body/h1',
			),
		)
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'click').length === 8)

		const rageClickSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.name === 'frustration' &&
				span.tags['frustration_type'] === 'rage' &&
				span.tags['interaction_type'] === 'click',
		)

		expect(rageClickSpans).toHaveLength(2) // h1 and #no-rage
		expect(rageClickSpans[0].duration).toBe(0)

		expect(recordPage.receivedSpans.filter(({ name }) => name === 'click')).toHaveLength(8)
	})

	test('Rage clicks modified settings', async ({ recordPage }) => {
		await recordPage.goTo('/frustration-signals/rage-click-modified.ejs')
		await makeClicks(recordPage)

		await recordPage.waitForSpans((spans) =>
			spans.some(
				(span) =>
					span.name === 'frustration' &&
					span.tags['frustration_type'] === 'rage' &&
					span.tags['interaction_type'] === 'click' &&
					span.tags['target_xpath'] === '//html/body/h1',
			),
		)
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'click').length === 8)

		const rageClickSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.name === 'frustration' &&
				span.tags['frustration_type'] === 'rage' &&
				span.tags['interaction_type'] === 'click',
		)

		expect(rageClickSpans).toHaveLength(1) // just h1
		expect(rageClickSpans[0].duration).toBe(0)

		expect(recordPage.receivedSpans.filter(({ name }) => name === 'click')).toHaveLength(8)
	})
})

async function makeClicks(recordPage: RecordPage) {
	await recordPage.evaluate(() => document.addEventListener('click', () => {}))

	await recordPage.locator('#no-rage').click()
	await recordPage.locator('#no-rage').click()
	await recordPage.locator('#no-rage').click()
	await recordPage.locator('#no-rage').click()
	await recordPage.locator('h1').click()
	await recordPage.locator('h1').click()
	await recordPage.locator('h1').click()
	await recordPage.locator('h1').click()
}
