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

test.describe('docload', () => {
	test('resources before load event are correctly captured', async ({ recordPage }) => {
		await recordPage.goTo('/docload/docload-all.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentLoad').length === 1)
		const docLoadSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentLoad')

		expect(docLoadSpans).toHaveLength(1)

		const resources = ['css-font-img.css', 'splunk-black.png?delay=300', 'iframe.ejs', 'splunk.woff']
		for (const urlEnd of resources) {
			const resourceSpans = recordPage.receivedSpans.filter(
				(span) => span.tags['http.url'] && (span.tags['http.url'] as string).endsWith(urlEnd),
			)

			expect(docLoadSpans[0].traceId, `${urlEnd} has correct traceId`).toBe(resourceSpans[0].traceId)
		}

		const ignoredResources = ['/some-data', '/some-data?delay=1', '/api/v2/spans']
		for (const urlEnd of ignoredResources) {
			const resourceSpans = recordPage.receivedSpans.filter(
				(span) =>
					span.tags['component'] === 'document-load' &&
					typeof span.tags['http.url'] === 'string' &&
					span.tags['http.url'].endsWith(urlEnd),
			)

			expect(resourceSpans, `${urlEnd} is not captured`).toHaveLength(0)
		}
	})

	test('documentFetch, resourceFetch, and documentLoad spans', async ({ recordPage, browserName }) => {
		await recordPage.goTo('/docload/docload.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentLoad').length === 1)
		const docLoadSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentLoad')
		const docFetchSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentFetch')
		const scriptFetchSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.name === 'resourceFetch' &&
				typeof span.tags['http.url'] === 'string' &&
				span.tags['http.url'].includes('splunk-otel-web.js'),
		)
		const brokenImageFetchSpans = recordPage.receivedSpans.filter(
			(span) =>
				span.name === 'resourceFetch' &&
				typeof span.tags['http.url'] === 'string' &&
				span.tags['http.url'].includes('/nosuchimage.jpg'),
		)

		expect(scriptFetchSpans).toHaveLength(1)

		// Firefox reports broken image resource twice
		expect(brokenImageFetchSpans).toHaveLength(browserName === 'firefox' ? 2 : 1)

		expect(docFetchSpans).toHaveLength(1)
		expect(docLoadSpans).toHaveLength(1)
		expect(docLoadSpans[0].traceId.match(/[a-f0-9]+/), 'Checking sanity of traceId').toBeTruthy()
		expect(docLoadSpans[0].id.match(/[a-f0-9]+/), 'Checking sanity of id').toBeTruthy()
		expect(docFetchSpans[0].traceId).toBe(docLoadSpans[0].traceId)
		expect(docFetchSpans[0].parentId).toBe(docLoadSpans[0].id)

		expect(scriptFetchSpans).toHaveLength(1)
		expect(scriptFetchSpans[0].traceId).toBe(docLoadSpans[0].traceId)
		expect(scriptFetchSpans[0].parentId).toBe(docLoadSpans[0].id)
		expect(scriptFetchSpans[0].tags['component']).toBe('document-load')
		if (browserName !== 'webkit') {
			// Webkit does not support https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
			expect(parseInt(scriptFetchSpans[0].tags['http.status_code'] as string)).toBe(200)
		}

		expect(brokenImageFetchSpans.length).toBeGreaterThanOrEqual(1)
		expect(brokenImageFetchSpans[0].traceId).toBe(docLoadSpans[0].traceId)
		expect(brokenImageFetchSpans[0].parentId).toBe(docLoadSpans[0].id)
		if (browserName !== 'webkit') {
			// Webkit does not support https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
			expect(parseInt(brokenImageFetchSpans[0].tags['http.status_code'] as string)).toBe(404)
		}

		expect(docFetchSpans[0].tags['component']).toBe('document-load')
		expect(docLoadSpans[0].tags['location.href']).toBe('http://localhost:3000/docload/docload.ejs')

		timesMakeSense(docFetchSpans[0].annotations, 'domainLookupStart', 'domainLookupEnd')
		timesMakeSense(docFetchSpans[0].annotations, 'connectStart', 'connectEnd')
		timesMakeSense(docFetchSpans[0].annotations, 'requestStart', 'responseStart')
		timesMakeSense(docFetchSpans[0].annotations, 'responseStart', 'responseEnd')
		timesMakeSense(docFetchSpans[0].annotations, 'fetchStart', 'responseEnd')

		expect(docFetchSpans[0].tags['link.traceId']).toBeDefined()
		expect(docFetchSpans[0].tags['link.spanId']).toBeDefined()
		if (browserName !== 'webkit') {
			// Webkit does not support https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
			expect(parseInt(docFetchSpans[0].tags['http.status_code'] as string)).toBe(200)
		}

		expect(parseInt(scriptFetchSpans[0].tags['http.response_content_length'] as string)).toBeGreaterThan(0)

		expect(docLoadSpans[0].tags['component']).toBe('document-load')
		expect(docLoadSpans[0].tags['location.href']).toBe('http://localhost:3000/docload/docload.ejs')
		expect(
			(docLoadSpans[0].tags['screen.xy'] as string).match(/[0-9]+x[0-9]+/),
			'Checking sanity of screen.xy',
		).toBeTruthy()

		timesMakeSense(docLoadSpans[0].annotations, 'domContentLoadedEventStart', 'domContentLoadedEventEnd')
		timesMakeSense(docLoadSpans[0].annotations, 'loadEventStart', 'loadEventEnd')
		timesMakeSense(docLoadSpans[0].annotations, 'fetchStart', 'domInteractive')
		timesMakeSense(docLoadSpans[0].annotations, 'fetchStart', 'domComplete')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('ignoring resource URLs', async ({ recordPage }) => {
		await recordPage.goTo('/docload/docload-ignored.ejs')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentFetch').length === 1)
		const ignoredResourceFetchSpans = recordPage.receivedSpans.filter(
			(span) => span.tags['http.url'] === 'http://localhost:3000/non-impactful-resource.jpg',
		)

		expect(ignoredResourceFetchSpans).toHaveLength(0)
	})

	test('module can be disabled', async ({ recordPage }) => {
		await recordPage.goTo('/docload/docload.ejs?disableInstrumentation=document')

		await recordPage.waitForTimeoutAndFlushData(1000)
		const SPAN_TYPES = ['documentFetch', 'documentLoad', 'resourceFetch']
		const documentSpans = recordPage.receivedSpans.filter((span) => SPAN_TYPES.includes(span.name))

		expect(documentSpans).toHaveLength(0)
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
