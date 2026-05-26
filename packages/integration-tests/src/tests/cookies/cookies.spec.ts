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

import { expectDefined, test } from '../../utils/test'

test.describe('cookies', () => {
	test('Connectivity events are captured', async ({ recordPage }) => {
		await recordPage.goTo('/cookies/cookies.ejs')

		// This should create two streams of documentLoad sequences, all with the same sessionId but having
		// two scriptInstances (one from parent, one from iframe)
		await recordPage.waitForSpans((spans) => spans.filter((s) => s.name === 'documentFetch').length === 2)
		const documentFetchSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentFetch')
		expect(documentFetchSpans).toHaveLength(2)

		const iframeDocumentFetchSpan = documentFetchSpans.find(
			(span) => span.attributes['location.href'] === 'http://localhost:3000/cookies/iframe.ejs',
		)
		const parentDocumentFetchSpan = documentFetchSpans.find(
			(span) => span.attributes['location.href'] === 'http://localhost:3000/cookies/cookies.ejs',
		)
		expectDefined(iframeDocumentFetchSpan)
		expectDefined(parentDocumentFetchSpan)

		// same sessionId& instanceId
		expect(iframeDocumentFetchSpan.attributes['splunk.rumSessionId']).toBe(
			parentDocumentFetchSpan.attributes['splunk.rumSessionId'],
		)
		expect(iframeDocumentFetchSpan.attributes['browser.instance.id']).toBe(
			parentDocumentFetchSpan.attributes['browser.instance.id'],
		)

		// different scriptInstance
		expect(iframeDocumentFetchSpan.attributes['splunk.scriptInstance']).not.toBe(
			parentDocumentFetchSpan.attributes['splunk.scriptInstance'],
		)

		const cookie = await recordPage.getCookie('_splunk_rum_sid')
		expect(cookie).toBeTruthy()

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('setting session cookie in iframe should work', async ({ browserName, recordPage }) => {
		await recordPage.goTo('/cookies/cookies.iframe.ejs')
		if (browserName === 'webkit') {
			// TODO: Does not work in webkit. Investigate
			test.skip()
		}

		await recordPage.waitForSpans((spans) =>
			spans.some((s) => s.name === 'documentFetch' && s.attributes['app'] === 'iframe'),
		)
		const documentFetchSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentFetch')
		expect(documentFetchSpans).toHaveLength(1)
		expect(documentFetchSpans[0].attributes['splunk.rumSessionId']).toBeTruthy()

		const cookie = await recordPage.getCookie('_splunk_rum_sid')
		expectDefined(cookie)
		expect(cookie.secure).toBe(true)
		expect(cookie.sameSite).toBe('None')
	})

	test('setting cookieDomain via config sets it on subdomains also', async ({ recordPage }) => {
		await recordPage.goTo(`http://127.0.0.1.nip.io:3000/cookies/cookies-domain.ejs`)
		const cookie1 = await recordPage.getCookie('_splunk_rum_sid')
		expectDefined(cookie1)
		const cookie1Decoded = JSON.parse(decodeURIComponent(cookie1.value)) as Record<string, unknown>

		await recordPage.goTo(`http://test.127.0.0.1.nip.io:3000/cookies/cookies-domain.ejs`)
		const cookie2 = await recordPage.getCookie('_splunk_rum_sid')
		expectDefined(cookie2)
		const cookie2Decoded = JSON.parse(decodeURIComponent(cookie2.value)) as Record<string, unknown>

		expect(cookie1Decoded['startTime']).toBe(cookie2Decoded['startTime'])
		expect(cookie1Decoded['id']).toBe(cookie2Decoded['id'])
		expect(cookie1.domain).toBe(cookie2.domain)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
