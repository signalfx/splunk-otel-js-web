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

test.describe('cookies', () => {
	test('Connectivity events are captured', async ({ recordPage }) => {
		await recordPage.goTo('/cookies/cookies.ejs')

		// This should create two streams of documentLoad sequences, all with the same sessionId but having
		// two scriptInstances (one from parent, one from iframe)
		await recordPage.waitForSpans((spans) => spans.filter((s) => s.name === 'documentFetch').length === 2)
		const documentFetchSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentFetch')
		expect(documentFetchSpans).toHaveLength(2)

		expect(documentFetchSpans[0].tags['location.href']).toBe('http://localhost:3000/cookies/iframe.ejs')
		expect(documentFetchSpans[1].tags['location.href']).toBe('http://localhost:3000/cookies/cookies.ejs')

		// same sessionId& instanceId
		expect(documentFetchSpans[0].tags['splunk.rumSessionId']).toBe(
			documentFetchSpans[1].tags['splunk.rumSessionId'],
		)
		expect(documentFetchSpans[0].tags['browser.instance.id']).toBe(
			documentFetchSpans[1].tags['browser.instance.id'],
		)

		// different scriptInstance
		expect(documentFetchSpans[0].tags['splunk.scriptInstance']).not.toBe(
			documentFetchSpans[1].tags['splunk.scriptInstance'],
		)

		const cookie = await recordPage.getCookie('_splunk_rum_sid')
		expect(cookie).toBeTruthy()

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('setting session cookie in iframe should work', async ({ recordPage, browserName }) => {
		await recordPage.goTo('/cookies/cookies.iframe.ejs')
		if (browserName === 'webkit') {
			// TODO: Does not work in webkit. Investigate
			test.skip()
		}

		await recordPage.waitForSpans((spans) =>
			spans.some((s) => s.name === 'documentFetch' && s.tags.app === 'iframe'),
		)
		const documentFetchSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentFetch')
		expect(documentFetchSpans).toHaveLength(1)
		expect(documentFetchSpans[0].tags['splunk.rumSessionId']).toBeTruthy()

		const cookie = await recordPage.getCookie('_splunk_rum_sid')
		expect(cookie).toBeTruthy()
		expect(cookie.secure).toBe(true)
		expect(cookie.sameSite).toBe('None')
	})

	test('setting cookieDomain via config sets it on subdomains also', async ({ recordPage }) => {
		await recordPage.goTo(`http://127.0.0.1.nip.io:3000/cookies/cookies-domain.ejs`)
		const cookie1 = await recordPage.getCookie('_splunk_rum_sid')
		const cookie1Decoded = decodeURIComponent(cookie1.value)

		expect(cookie1).toBeTruthy()

		await recordPage.goTo(`http://test.127.0.0.1.nip.io:3000/cookies/cookies-domain.ejs`)
		const cookie2 = await recordPage.getCookie('_splunk_rum_sid')
		const cookie2Decoded = decodeURIComponent(cookie2.value)

		expect(cookie2).toBeTruthy()

		expect(cookie1Decoded['startTime']).toBe(cookie2Decoded['startTime'])
		expect(cookie1Decoded['sessionId']).toBe(cookie2Decoded['sessionId'])
		expect(cookie1.domain).toBe(cookie2.domain)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
