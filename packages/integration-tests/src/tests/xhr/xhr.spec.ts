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

test.describe('xhr', () => {
	test('XHR request is registered', async ({ recordPage }) => {
		await recordPage.goTo('/xhr/xhr-basic.ejs')
		await recordPage.waitForSpans(
			(spans) =>
				spans.filter((span) => span.attributes['http.url'] === 'http://localhost:3000/some-data').length === 1,
		)
		const xhrSpans = recordPage.receivedSpans.filter(
			(span) => span.attributes['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(xhrSpans).toHaveLength(1)
		expect(xhrSpans[0]).toHaveSpanAttribute('component', 'xml-http-request')
		expect(xhrSpans[0]).toHaveSpanAttribute('http.status_code', 200)
		expect(xhrSpans[0]).toHaveSpanAttribute('http.status_text', 'OK')
		expect(xhrSpans[0]).toHaveSpanAttribute('http.method', 'GET')
		expect(xhrSpans[0]).toHaveSpanAttribute('http.url', 'http://localhost:3000/some-data')
		expect(xhrSpans[0]).toHaveSpanAttribute('http.response_content_length', 49)
		expect(xhrSpans[0].attributes['browser.resource.cross_origin_timing_restricted']).toBeUndefined()
		expect(xhrSpans[0]).toHaveSpanAttribute('link.traceId')
		expect(xhrSpans[0]).toHaveSpanAttribute('link.spanId')
	})

	test('classifies timing restrictions for cross-origin XHR resources', async ({ recordPage }) => {
		await recordPage.goTo('/xhr/xhr-basic.ejs')

		const resourceUrls = await recordPage.evaluate(async () => {
			const cacheKey = Date.now()
			const urls = ['off', 'on'].map(
				(tao) => `http://localhost:3001/timing-resource?tao=${tao}&noCache=${cacheKey}`,
			)

			const request = (url: string) =>
				new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest()
					xhr.addEventListener('load', () => resolve(), { once: true })
					xhr.addEventListener('error', () => reject(new Error(`XHR failed: ${url}`)), { once: true })
					xhr.open('GET', url)
					xhr.send()
				})

			await Promise.all(urls.map(request))

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

	test('module can be disabled', async ({ recordPage }) => {
		await recordPage.goTo('/xhr/xhr-basic.ejs?disableInstrumentation=xhr')
		await recordPage.waitForTimeout(1000)

		const xhrSpans = recordPage.receivedSpans.filter(
			(span) => span.attributes['http.url'] === 'http://localhost:3000/some-data',
		)

		expect(xhrSpans).toHaveLength(0)
	})

	test('XHR request can be ignored', async ({ recordPage }) => {
		await recordPage.goTo('/xhr/xhr-ignored.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'guard-span').length === 1)

		const xhrSpans = recordPage.receivedSpans.filter((span) =>
			['http://localhost:3000/some-data', 'http://localhost:3000/no-server-timings'].includes(
				String(span.attributes['http.url']),
			),
		)
		const guardSpans = recordPage.receivedSpans.filter((span) => span.name === 'guard-span')

		expect(xhrSpans).toHaveLength(0)
		expect(guardSpans).toHaveLength(1)
	})
})
