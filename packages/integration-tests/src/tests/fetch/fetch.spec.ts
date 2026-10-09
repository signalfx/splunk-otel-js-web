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

import { test } from '../../utils/test'
import { timesMakeSense } from '../../utils/time-make-sense'

test.describe('fetch', () => {
	test('span created for fetch includes all properties', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch.ejs')

		await recordPage.waitForSpans(
			(spans) =>
				spans.filter((span) => span.attributes['http.url'] === 'http://localhost:3000/some-data').length === 1,
		)
		const fetchSpans = recordPage.receivedSpans.filter(
			(span) => span.attributes['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(fetchSpans).toHaveLength(1)
		expect(fetchSpans[0]).toHaveSpanAttribute('component', 'fetch')
		expect(fetchSpans[0]).toHaveSpanAttribute('http.status_code', 200)
		expect(fetchSpans[0]).toHaveSpanAttribute('http.status_text', 'OK')
		expect(fetchSpans[0]).toHaveSpanAttribute('http.method', 'GET')
		expect(fetchSpans[0]).toHaveSpanAttribute('http.url', 'http://localhost:3000/some-data')
		expect(fetchSpans[0]).toHaveSpanAttribute('http.response_content_length', 49)
		expect(fetchSpans[0].attributes['browser.resource.cross_origin_timing_restricted']).toBeUndefined()
		expect(fetchSpans[0]).toHaveSpanAttribute('link.traceId')
		expect(fetchSpans[0]).toHaveSpanAttribute('link.spanId')

		timesMakeSense(fetchSpans[0].events, 'domainLookupStart', 'domainLookupEnd')
		timesMakeSense(fetchSpans[0].events, 'connectStart', 'connectEnd')
		timesMakeSense(fetchSpans[0].events, 'requestStart', 'responseStart')
		timesMakeSense(fetchSpans[0].events, 'responseStart', 'responseEnd')
		timesMakeSense(fetchSpans[0].events, 'fetchStart', 'responseEnd')

		// TODO: secure server is not available in our test environment
		// timesMakeSense(fetchSpans[0].events, 'secureConnectionStart', 'connectEnd')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('classifies timing restrictions for cross-origin fetch resources', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch.ejs')

		const resourceUrls = await recordPage.evaluate(async () => {
			const cacheKey = Date.now()
			const urls = ['off', 'on'].map(
				(tao) => `http://localhost:3001/timing-resource?tao=${tao}&noCache=${cacheKey}`,
			)

			await Promise.all(urls.map((url) => fetch(url).then((response) => response.arrayBuffer())))

			return urls
		})

		await recordPage.waitForSpans((spans) =>
			resourceUrls.every((url) => spans.some((span) => span.attributes['http.url'] === url)),
		)
		const timingEntries = await recordPage.evaluate(
			(urls) =>
				urls.map((url) => {
					const entry = performance.getEntriesByName(url)[0] as PerformanceResourceTiming | undefined
					return (
						entry && {
							decodedBodySize: entry.decodedBodySize,
							encodedBodySize: entry.encodedBodySize,
							requestStart: entry.requestStart,
							responseStart: entry.responseStart,
							transferSize: entry.transferSize,
						}
					)
				}),
			resourceUrls,
		)
		const resourceSpans = recordPage.receivedSpans.filter((span) =>
			resourceUrls.includes(String(span.attributes['http.url'])),
		)
		expect(resourceSpans).toHaveLength(2)

		const timingRestrictedSpan = resourceSpans.find((span) => span.attributes['http.url'] === resourceUrls[0])
		const timingExposedSpan = resourceSpans.find((span) => span.attributes['http.url'] === resourceUrls[1])
		const [restrictedEntry, exposedEntry] = timingEntries
		expect(restrictedEntry?.requestStart).toBe(0)
		expect(restrictedEntry?.responseStart).toBe(0)
		expect(exposedEntry?.requestStart).toBeGreaterThan(0)
		expect(exposedEntry?.responseStart).toBeGreaterThan(0)

		const restrictedSizes = [
			restrictedEntry?.transferSize,
			restrictedEntry?.encodedBodySize,
			restrictedEntry?.decodedBodySize,
		]
		expect(restrictedSizes.every((size) => typeof size === 'number' && Number.isFinite(size))).toBe(true)
		const expectedRestrictedValue = restrictedSizes.every((size) => size === 0) ? true : undefined
		expect(timingRestrictedSpan?.attributes['browser.resource.cross_origin_timing_restricted']).toBe(
			expectedRestrictedValue,
		)
		expect(timingExposedSpan?.attributes['browser.resource.cross_origin_timing_restricted']).toBe(false)
	})

	test('fetch request can be ignored', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch-ignored.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'guard-span').length === 1)

		const fetchSpans = recordPage.receivedSpans.filter((span) =>
			['http://localhost:3000/some-data', 'http://localhost:3000/no-server-timings'].includes(
				String(span.attributes['http.url']),
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
			(span) => span.attributes['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(xhrSpans).toHaveLength(0)
	})

	test('request body exists in request object (open-telemetry/opentelemetry-js#2411)', async ({ recordPage }) => {
		await recordPage.goTo('/fetch/fetch-post.ejs')
		await recordPage.waitForSpans(
			(spans) =>
				spans.filter((span) => span.attributes['http.url'] === 'http://localhost:3000/echo').length === 1,
		)

		const resultElementText = await recordPage.locator('#result').textContent()

		expect(resultElementText).toBe('{"test":true}')
	})

	test('fetch reported over CORS', async ({ recordPage }) => {
		const url = new URL('/fetch/fetch.ejs', 'http://localhost:3001')
		url.searchParams.set('beaconEndpoint', 'http://localhost:3000/api/v2/spans')

		await recordPage.goTo(url.toString())
		await recordPage.waitForSpans(
			(spans) =>
				spans.filter((span) => span.attributes['http.url'] === 'http://localhost:3001/some-data').length === 1,
		)

		const fetchSpans = recordPage.receivedSpans.filter(
			(span) => span.attributes['http.url'] === 'http://localhost:3001/some-data',
		)

		expect(fetchSpans).toHaveLength(1)
		expect(fetchSpans[0]).toHaveSpanAttribute('component', 'fetch')
		expect(fetchSpans[0]).toHaveSpanAttribute('http.status_code', 200)
		expect(fetchSpans[0]).toHaveSpanAttribute('http.status_text', 'OK')
		expect(fetchSpans[0]).toHaveSpanAttribute('http.method', 'GET')
		expect(fetchSpans[0]).toHaveSpanAttribute('http.host', 'localhost:3001')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
