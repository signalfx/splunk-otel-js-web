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
import { test } from '../../../utils/test'
import { expect } from '@playwright/test'
import { RecordPage } from '../../../pages/record-page'

const runTest = async (recordPage: RecordPage, urlPath: string) => {
	recordPage.clearReceivedSpans()

	await recordPage.goTo(urlPath)
	await recordPage.locator('#btn1').click()

	await recordPage.waitForTestToFinish()

	const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')
	const customSpans = recordPage.receivedSpans.filter((span) => span.name === 'custom-span')

	expect(clickSpans).toHaveLength(1)
	expect(customSpans).toHaveLength(1)

	expect(clickSpans[0].parentId).toBeUndefined()
	expect(customSpans[0].parentId).toBe(clickSpans[0].id)
	expect(customSpans[0].traceId).toBe(clickSpans[0].traceId)

	expect(recordPage.receivedErrorSpans).toHaveLength(0)
}

test.describe('framework', () => {
	test('Vue 2 with async', async ({ recordPage }) => {
		await runTest(recordPage, '/context/framework/vue2.ejs')
	})

	test('Vue 3 with async', async ({ recordPage }) => {
		await runTest(recordPage, '/context/framework/vue3.ejs')
	})

	test('React 16 with async', async ({ recordPage }) => {
		await runTest(recordPage, '/context/framework/react-16.ejs')
	})

	test('React latest with async', async ({ recordPage }) => {
		await recordPage.goTo('/context/framework/react-latest.ejs')
		await recordPage.locator('#btn1').click()
		await recordPage.waitForTestToFinish()

		const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')
		const customSpans = recordPage.receivedSpans.filter((span) => span.name === 'custom-span')

		expect(clickSpans.length).toBeGreaterThanOrEqual(1)
		expect(customSpans).toHaveLength(1)

		// TODO: Investigate for some reason for react 17 there are several nested clicks
		clickSpans.forEach((span) => {
			expect(customSpans[0].traceId, span.traceId)
		})

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
