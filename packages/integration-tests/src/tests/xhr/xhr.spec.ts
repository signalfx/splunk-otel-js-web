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

test.describe('xhr', () => {
	test('XHR request is registered', async ({ recordPage }) => {
		await recordPage.goTo('/xhr/xhr-basic.ejs')
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.tags['http.url'] === 'http://localhost:3000/some-data').length === 1,
		)
		const xhrSpans = recordPage.receivedSpans.filter(
			(span) => span.tags['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(xhrSpans).toHaveLength(1)
		expect(xhrSpans[0].tags['component']).toBe('xml-http-request')
		expect(xhrSpans[0].tags['http.status_code']).toBe('200')
		expect(xhrSpans[0].tags['http.status_text']).toBe('OK')
		expect(xhrSpans[0].tags['http.method']).toBe('GET')
		expect(xhrSpans[0].tags['http.url']).toBe('http://localhost:3000/some-data')
		expect(xhrSpans[0].tags['http.response_content_length']).toBe('49')
		expect(xhrSpans[0].tags['link.traceId']).toBeTruthy()
		expect(xhrSpans[0].tags['link.spanId']).toBeTruthy()
	})

	test('module can be disabled', async ({ recordPage }) => {
		await recordPage.goTo('/xhr/xhr-basic.ejs?disableInstrumentation=xhr')
		await recordPage.waitForTimeout(1000)

		const xhrSpans = recordPage.receivedSpans.filter(
			(span) => span.tags['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(xhrSpans).toHaveLength(0)
	})

	test('XHR request can be ignored', async ({ recordPage }) => {
		await recordPage.goTo('/xhr/xhr-ignored.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'guard-span').length === 1)

		const xhrSpans = recordPage.receivedSpans.filter((span) =>
			['http://localhost:3000/some-data', 'http://localhost:3000/no-server-timings'].includes(
				span.tags['http.url'] as string,
			),
		)
		const guardSpans = recordPage.receivedSpans.filter((span) => span.name === 'guard-span')

		expect(xhrSpans).toHaveLength(0)
		expect(guardSpans).toHaveLength(1)
	})
})
