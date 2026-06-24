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
import { hrTimeToMilliseconds } from '@opentelemetry/core'
import { expect } from '@playwright/test'

import { BROWSER_NAVIGATION_ATTRIBUTES, expectBrowserNavigationAttributes } from '../../utils/browser-navigation'
import { expectDefined, test } from '../../utils/test'
import { timesMakeSense } from '../../utils/time-make-sense'

test.describe('docload', () => {
	test('resources before load event are correctly captured', async ({ recordPage }) => {
		await recordPage.goTo('/docload/docload-all.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentLoad').length === 1)
		const docLoadSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentLoad')

		expect(docLoadSpans).toHaveLength(1)

		const resources = ['css-font-img.css', 'splunk-black.png?delay=300', 'iframe.ejs', 'splunk.woff']
		for (const urlEnd of resources) {
			const resourceSpan = recordPage.receivedSpans.find(
				(span) => span.attributes['http.url'] && String(span.attributes['http.url']).endsWith(urlEnd),
			)

			expect(resourceSpan, `${urlEnd} span should exist`).toBeDefined()
			expect(docLoadSpans[0].traceId, `${urlEnd} has correct traceId`).toBe(resourceSpan!.traceId)
		}

		const ignoredResources = ['/some-data', '/some-data?delay=1', '/api/v2/spans']
		for (const urlEnd of ignoredResources) {
			const resourceSpans = recordPage.receivedSpans.filter(
				(span) =>
					span.attributes['component'] === 'document-load' &&
					typeof span.attributes['http.url'] === 'string' &&
					String(span.attributes['http.url']).endsWith(urlEnd),
			)

			expect(resourceSpans, `${urlEnd} is not captured`).toHaveLength(0)
		}
	})

	test('documentFetch, resourceFetch, and documentLoad spans', async ({ browserName, recordPage }) => {
		await recordPage.goTo('/docload/docload.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentLoad').length === 1)
		const docLoadSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentLoad')
		const docFetchSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentFetch')

		const scriptFetchSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.name === 'resourceFetch' &&
				typeof span.attributes['http.url'] === 'string' &&
				String(span.attributes['http.url']).includes('splunk-otel-web.js'),
		)
		const brokenImageFetchSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.name === 'resourceFetch' &&
				typeof span.attributes['http.url'] === 'string' &&
				String(span.attributes['http.url']).includes('/nosuchimage.jpg'),
		)

		expect(scriptFetchSpans).toHaveLength(1)

		// Firefox and Webkit reports broken image resource twice
		if (browserName === 'firefox' || browserName === 'webkit') {
			expect(brokenImageFetchSpans.length).toBeGreaterThanOrEqual(1)
		} else {
			expect(brokenImageFetchSpans).toHaveLength(1)
		}

		expect(docFetchSpans).toHaveLength(1)
		expect(docLoadSpans).toHaveLength(1)
		expect(docLoadSpans[0].traceId.match(/[a-f0-9]+/), 'Checking sanity of traceId').toBeTruthy()
		expect(docLoadSpans[0].spanId.match(/[a-f0-9]+/), 'Checking sanity of spanId').toBeTruthy()
		expect(docFetchSpans[0].traceId).toBe(docLoadSpans[0].traceId)
		expect(docFetchSpans[0].parentSpanId).toBe(docLoadSpans[0].spanId)

		expect(scriptFetchSpans).toHaveLength(1)
		expect(scriptFetchSpans[0].traceId).toBe(docLoadSpans[0].traceId)
		expect(scriptFetchSpans[0].parentSpanId).toBe(docLoadSpans[0].spanId)
		expect(scriptFetchSpans[0]).toHaveSpanAttribute('component', 'document-load')
		if (browserName !== 'webkit') {
			// Webkit does not support https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
			expect(Number.parseInt(String(scriptFetchSpans[0].attributes['http.status_code']))).toBe(200)
			expect(scriptFetchSpans[0]).toHaveSpanAttribute('http.cache.hit', false)
		}

		expect(brokenImageFetchSpans.length).toBeGreaterThanOrEqual(1)
		expect(brokenImageFetchSpans[0].traceId).toBe(docLoadSpans[0].traceId)
		expect(brokenImageFetchSpans[0].parentSpanId).toBe(docLoadSpans[0].spanId)
		if (browserName !== 'webkit') {
			// Webkit does not support https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
			expect(Number.parseInt(String(brokenImageFetchSpans[0].attributes['http.status_code']))).toBe(404)
		}

		expect(docFetchSpans[0]).toHaveSpanAttribute('component', 'document-load')
		expect(docLoadSpans[0]).toHaveSpanAttribute('location.href', 'http://localhost:3000/docload/docload.ejs')

		timesMakeSense(docFetchSpans[0].events, 'domainLookupStart', 'domainLookupEnd')
		timesMakeSense(docFetchSpans[0].events, 'connectStart', 'connectEnd')
		timesMakeSense(docFetchSpans[0].events, 'requestStart', 'responseStart')
		timesMakeSense(docFetchSpans[0].events, 'responseStart', 'responseEnd')
		timesMakeSense(docFetchSpans[0].events, 'fetchStart', 'responseEnd')

		expect(docFetchSpans[0]).toHaveSpanAttribute('link.traceId')
		expect(docFetchSpans[0]).toHaveSpanAttribute('link.spanId')
		if (browserName !== 'webkit') {
			// Webkit does not support https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
			expect(Number.parseInt(String(docFetchSpans[0].attributes['http.status_code']))).toBe(200)
		}

		expect(Number.parseInt(String(scriptFetchSpans[0].attributes['http.response_content_length']))).toBeGreaterThan(
			0,
		)

		expect(docLoadSpans[0]).toHaveSpanAttribute('component', 'document-load')
		expect(docLoadSpans[0]).toHaveSpanAttribute('location.href', 'http://localhost:3000/docload/docload.ejs')
		expect(docLoadSpans[0]).toHaveSpanAttributeMatching('screen.xy', /[0-9]+x[0-9]+/)

		if (browserName !== 'webkit') {
			// WebKit reports domInteractive, domContentLoadedEventStart/End, and domComplete as 0
			// in PerformanceNavigationTiming, so the OTel SDK skips adding them as span events
			// (they appear before fetchStart, failing the perfTime >= refTime check).
			timesMakeSense(docLoadSpans[0].events, 'domContentLoadedEventStart', 'domContentLoadedEventEnd')
			timesMakeSense(docLoadSpans[0].events, 'fetchStart', 'domInteractive')
			timesMakeSense(docLoadSpans[0].events, 'fetchStart', 'domComplete')
		}

		timesMakeSense(docLoadSpans[0].events, 'loadEventStart', 'loadEventEnd')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('ignoring resource URLs', async ({ recordPage }) => {
		await recordPage.goTo('/docload/docload-ignored.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentFetch').length === 1)
		const ignoredResourceFetchSpans = recordPage.receivedSpans.filter(
			(span) => span.attributes['http.url'] === 'http://localhost:3000/non-impactful-resource.jpg',
		)

		expect(ignoredResourceFetchSpans).toHaveLength(0)
	})

	test('documentLoad span has docLoad duration on empty page', async ({ recordPage }) => {
		await recordPage.goTo('/docload/docload-empty.ejs')

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'documentLoad'))

		const docLoadSpan = recordPage.receivedSpans.find((span) => span.name === 'documentLoad')
		expectDefined(docLoadSpan)
		expectBrowserNavigationAttributes(docLoadSpan, { status: 'completed' })

		const pct = Number(docLoadSpan.attributes[BROWSER_NAVIGATION_ATTRIBUTES.pageCompletionTime])
		expect(pct).toBeGreaterThan(0)

		// pct uses the same loadEventEnd - fetchStart calculation as the exported documentLoad span.
		const durationMs = hrTimeToMilliseconds(docLoadSpan.duration)
		// The span duration is serialized through OTLP HrTime and converted back to milliseconds.
		// WebKit can report an equivalent integer PCT while durationMs lands just below the next millisecond.
		expect(pct).toBeGreaterThanOrEqual(Math.floor(durationMs))
	})

	test('module can be disabled', async ({ recordPage }) => {
		await recordPage.goTo('/docload/docload.ejs?disableInstrumentation=document')

		await recordPage.waitForTimeoutAndFlushData(1000)
		const SPAN_TYPES = new Set(['documentFetch', 'documentLoad', 'resourceFetch'])
		const documentSpans = recordPage.receivedSpans.filter((span) => SPAN_TYPES.has(span.name))

		expect(documentSpans).toHaveLength(0)
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
