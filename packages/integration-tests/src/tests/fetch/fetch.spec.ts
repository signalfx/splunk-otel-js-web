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
import { timesMakeSense } from '../../utils/time-make-sense'

test.describe('fetch', () => {
	test('span created for fetch includes all properties', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch.ejs')

		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.tags['http.url'] === 'http://localhost:3000/some-data').length === 1,
		)
		const fetchSpans = recordPage.receivedSpans.filter(
			(span) => span.tags['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(fetchSpans).toHaveLength(1)
		expect(fetchSpans[0].tags['component']).toBe('fetch')
		expect(fetchSpans[0].tags['http.status_code']).toBe('200')
		expect(fetchSpans[0].tags['http.status_text']).toBe('OK')
		expect(fetchSpans[0].tags['http.method']).toBe('GET')
		expect(fetchSpans[0].tags['http.url']).toBe('http://localhost:3000/some-data')
		expect(fetchSpans[0].tags['http.response_content_length']).toBe('49')
		expect(fetchSpans[0].tags['link.traceId']).toBeTruthy()
		expect(fetchSpans[0].tags['link.spanId']).toBeTruthy()

		timesMakeSense(fetchSpans[0].annotations, 'domainLookupStart', 'domainLookupEnd')
		timesMakeSense(fetchSpans[0].annotations, 'connectStart', 'connectEnd')
		timesMakeSense(fetchSpans[0].annotations, 'requestStart', 'responseStart')
		timesMakeSense(fetchSpans[0].annotations, 'responseStart', 'responseEnd')
		timesMakeSense(fetchSpans[0].annotations, 'fetchStart', 'responseEnd')

		// TODO: secure server is not available in our test environment
		// timesMakeSense(fetchSpans[0].annotations, 'secureConnectionStart', 'connectEnd')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('fetch request can be ignored', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch-ignored.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'guard-span').length === 1)

		const fetchSpans = recordPage.receivedSpans.filter((span) =>
			['http://localhost:3000/some-data', 'http://localhost:3000/no-server-timings'].includes(
				span.tags['http.url'] as string,
			),
		)
		const guardSpans = recordPage.receivedSpans.filter((span) => span.name === 'guard-span')

		expect(fetchSpans).toHaveLength(0)
		expect(guardSpans).toHaveLength(1)
	})

	test('can be disabled (with xhr switch)', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch.ejs?disableInstrumentation=xhr,fetch')
		await recordPage.waitForTimeout(1000)

		const xhrSpans = recordPage.receivedSpans.filter(
			(span) => span.tags['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(xhrSpans).toHaveLength(0)
	})

	test('request body exists in request object (open-telemetry/opentelemetry-js#2411)', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch-post.ejs')
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.tags['http.url'] === 'http://localhost:3000/echo').length === 1,
		)

		const resultElementText = await recordPage.locator('#result').textContent()

		expect(resultElementText).toBe('{"test":true}')
	})

	test('fetch reported over CORS', async ({ recordPage }) => {
		const url = new URL('/fetch/fetch.ejs', 'http://localhost:3001')
		url.searchParams.set('beaconEndpoint', 'http://localhost:3000/api/v2/spans')

		await recordPage.goTo(url.toString())
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.tags['http.url'] === 'http://localhost:3001/some-data').length === 1,
		)

		const fetchSpans = recordPage.receivedSpans.filter(
			(span) => span.tags['http.url'] === 'http://localhost:3001/some-data',
		)

		expect(fetchSpans).toHaveLength(1)
		expect(fetchSpans[0].tags['component']).toBe('fetch')
		expect(fetchSpans[0].tags['http.status_code']).toBe('200')
		expect(fetchSpans[0].tags['http.status_text']).toBe('OK')
		expect(fetchSpans[0].tags['http.method']).toBe('GET')
		expect(fetchSpans[0].tags['http.host']).toBe('localhost:3001')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
