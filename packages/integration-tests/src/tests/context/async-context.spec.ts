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
import { RecordPage } from '../../pages/record-page'

const runTest = async (recordPage: RecordPage, urlPath: string) => {
	await recordPage.goTo(urlPath)

	await recordPage.locator('#btn1').click()

	await recordPage.waitForTestToFinish()

	const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')
	const childSpans = recordPage.receivedSpans.filter((span) => span.name === 'context-child')

	expect(clickSpans).toHaveLength(1)
	expect(clickSpans[0].parentId).toBeUndefined()
	expect(childSpans).toHaveLength(1)
	expect(childSpans[0].parentId).toBe(clickSpans[0].id)

	expect(recordPage.receivedErrorSpans).toHaveLength(0)
}

test.describe('context', () => {
	test('setTimeout', async ({ recordPage }) => {
		await runTest(recordPage, '/context/set-timeout.ejs')
		recordPage.clearReceivedSpans()

		await recordPage.locator('#btn2').click()
		await recordPage.waitForTimeout(1000)
		await recordPage.waitForTestToFinish()

		const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')
		const childSpans = recordPage.receivedSpans.filter((span) => span.name === 'context-child')

		expect(clickSpans).toHaveLength(1)
		expect(childSpans).toHaveLength(1)
		expect(childSpans[0].parentId, "Child span in a longer timeout doesn't have a parent").toBeUndefined()
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('promise constructor', async ({ recordPage }) => {
		await recordPage.goTo('/context/promise.ejs')

		for (let i = 1; i <= 5; i++) {
			await recordPage.locator('#btn' + i).click()
			await recordPage.waitForTimeout(1000)
			await recordPage.waitForTestToFinish()

			const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')
			const childSpans = recordPage.receivedSpans.filter((span) => span.name === 'context-child')

			expect(clickSpans).toHaveLength(1)
			expect(childSpans).toHaveLength(1)
			expect(childSpans[0].parentId).toBeDefined()
			expect(childSpans[0].parentId, `Child span ${i} belongs to user interaction trace.`).toBe(clickSpans[0].id)

			expect(recordPage.receivedErrorSpans).toHaveLength(0)
			recordPage.clearReceivedSpans()
		}
	})

	test('fetch then', async ({ recordPage }) => {
		await runTest(recordPage, '/context/fetch-then.ejs')
	})

	test('xhr event callback', async ({ recordPage }) => {
		await runTest(recordPage, '/context/xhr-events.ejs')
	})

	test('xhr event with removal', async ({ recordPage }) => {
		await runTest(recordPage, '/context/xhr-events-removed.ejs')
	})

	test('xhr onload property', async ({ recordPage }) => {
		await runTest(recordPage, '/context/xhr-onload.ejs')
	})

	test('mutation observer on textNode', async ({ recordPage }) => {
		await runTest(recordPage, '/context/mutation-observer-textnode.ejs')
	})

	test('MessagePort - addEventListener', async ({ recordPage }) => {
		await runTest(recordPage, '/context/messageport-addeventlistener.ejs')
	})

	test('MessagePort - onmessage', async ({ recordPage }) => {
		await runTest(recordPage, '/context/messageport-onmessage.ejs')
	})

	test('MessagePort: Works with cors', async ({ recordPage }) => {
		await recordPage.goTo('/context/messageport-cors.ejs')
		await recordPage.waitForTestToFinish()

		const messageEventSpans = recordPage.receivedSpans.filter((span) => span.name === 'message-event')

		expect(messageEventSpans).toHaveLength(1)
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('location - hashchange', async ({ recordPage }) => {
		await runTest(recordPage, '/context/location-hash.ejs')

		const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')
		const routeChangeSpans = recordPage.receivedSpans.filter((span) => span.name === 'routeChange')

		expect(clickSpans).toHaveLength(1)
		expect(routeChangeSpans).toHaveLength(1)

		expect(routeChangeSpans[0].parentId).toBe(clickSpans[0].id)
	})
})
