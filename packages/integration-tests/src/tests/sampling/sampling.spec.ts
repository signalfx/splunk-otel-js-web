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

test.describe('sampling', () => {
	test('all spans arrive if ratio is 1', async ({ recordPage }) => {
		await recordPage.goTo('/sampling/sampling.ejs?samplingRatio=1')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'guard-span').length === 1)
	})

	test('no spans arrive if ratio is 0', async ({ recordPage }) => {
		await recordPage.goTo('/sampling/sampling.ejs?samplingRatio=0')
		await recordPage.waitForTimeout(1000)

		expect(recordPage.receivedSpans).toHaveLength(0)
	})

	test('all spans arrive if session was sampled', async ({ recordPage }) => {
		await recordPage.goTo(
			'/sampling/sampling.ejs?samplingRatio=0.99&forceSessionId=a0000000000000000000000000000000',
		)
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'guard-span').length === 1)

		const sessionCookieEncoded = await recordPage.getCookie('_splunk_rum_sid')
		expect(sessionCookieEncoded).toBeTruthy()

		const sessionCookieRaw = decodeURIComponent(sessionCookieEncoded.value)
		expect(JSON.parse(sessionCookieRaw).id).toBe('a0000000000000000000000000000000')
	})

	test('no spans arrive if session was not sampled', async ({ recordPage }) => {
		await recordPage.goTo(
			'/sampling/sampling.ejs?samplingRatio=0.01&forceSessionId=a0000000000000000000000000000000',
		)
		await recordPage.waitForTimeout(1000)

		expect(recordPage.receivedSpans).toHaveLength(0)

		const sessionCookieEncoded = await recordPage.getCookie('_splunk_rum_sid')
		expect(sessionCookieEncoded).toBeTruthy()

		const sessionCookieRaw = decodeURIComponent(sessionCookieEncoded.value)
		expect(JSON.parse(sessionCookieRaw).id).toBe('a0000000000000000000000000000000')
	})
})
