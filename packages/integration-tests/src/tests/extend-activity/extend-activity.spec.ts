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

test.describe('extend-activity', () => {
	test('only user activity extends session', async ({ recordPage }) => {
		await recordPage.goTo('/extend-activity/some.ejs')

		const sessionCookie1 = await recordPage.getCookie('_splunk_rum_sid')

		expect(sessionCookie1).toBeTruthy()

		const sessionCookie1Parsed = JSON.parse(decodeURIComponent(sessionCookie1.value))

		await recordPage.waitForTimeout(1500)

		await recordPage.evaluate(() => {
			;(window as any).SplunkRum.provider.getTracer('guard').startSpan('guard-span').end()
		})

		await recordPage.waitForTimeout(1500)

		const sessionCookie2 = await recordPage.getCookie('_splunk_rum_sid')

		expect(sessionCookie2).toBeTruthy()

		const sessionCookie2Parsed = JSON.parse(decodeURIComponent(sessionCookie2.value))

		expect(sessionCookie1Parsed.expiresAt).toBe(sessionCookie2Parsed.expiresAt)

		expect(recordPage.receivedSpans.filter((s) => s.name === 'guard-span')).toHaveLength(1)
	})

	test('all spans extend session', async ({ recordPage }) => {
		await recordPage.goTo('/extend-activity/all.ejs')

		const sessionCookie1 = await recordPage.getCookie('_splunk_rum_sid')

		expect(sessionCookie1).toBeTruthy()

		const sessionCookie1Parsed = JSON.parse(decodeURIComponent(sessionCookie1.value))

		await recordPage.waitForTimeout(1500)

		await recordPage.evaluate(() => {
			;(window as any).SplunkRum.provider.getTracer('guard').startSpan('guard-span').end()
		})

		await recordPage.waitForTimeout(1500)

		const sessionCookie2 = await recordPage.getCookie('_splunk_rum_sid')

		expect(sessionCookie2).toBeTruthy()

		const sessionCookie2Parsed = JSON.parse(decodeURIComponent(sessionCookie2.value))

		expect(sessionCookie1Parsed.expiresAt).toBeLessThan(sessionCookie2Parsed.expiresAt)

		expect(recordPage.receivedSpans.filter((s) => s.name === 'guard-span')).toHaveLength(1)
	})
})
