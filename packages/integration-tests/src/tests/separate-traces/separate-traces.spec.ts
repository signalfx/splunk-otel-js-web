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

const isTestXhrSpan = (span: { tags: Record<string, string> }) =>
	span.tags['component'] === 'xml-http-request' &&
	(span.tags['http.url']?.includes('/some-data') || span.tags['http.url']?.includes('/no-server-timings'))

const isTraceparentXhrSpan = (span: { tags: Record<string, string> }) =>
	span.tags['component'] === 'xml-http-request' && span.tags['http.url']?.includes('/echo-traceparent')

test.describe('separateTraces configuration', () => {
	test.describe('XHR with separateTraces: true', () => {
		test('click triggering XHR creates separate traces with parent links', async ({ recordPage }) => {
			await recordPage.goTo('/separate-traces/click-xhr.ejs')
			await recordPage.locator('#btnTriggerXhr').click()

			await recordPage.waitForSpans(
				(spans) => spans.some((span) => span.name === 'click') && spans.filter(isTestXhrSpan).length >= 2,
			)

			const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
			const xhrSpans = recordPage.receivedSpans.filter(isTestXhrSpan)

			expect(clickSpan).toBeDefined()
			expect(xhrSpans.length).toBeGreaterThanOrEqual(2)

			// Each XHR span should have a DIFFERENT trace ID than the click span
			for (const xhrSpan of xhrSpans) {
				expect(xhrSpan.traceId).not.toBe(clickSpan!.traceId)

				// XHR span should be a root span (no parentId)
				expect(xhrSpan.parentId).toBeUndefined()

				// Verify parent span info is stored as attributes
				expect(xhrSpan.tags['link.interaction.spanId']).toBeDefined()
				expect(xhrSpan.tags['link.interaction.traceId']).toBeDefined()
			}

			// Each XHR span should have a unique trace ID
			const xhrTraceIds = xhrSpans.map((span) => span.traceId)
			const uniqueTraceIds = new Set(xhrTraceIds)
			expect(uniqueTraceIds.size).toBe(xhrSpans.length)

			expect(recordPage.receivedErrorSpans).toHaveLength(0)
		})
	})

	test.describe('XHR with separateTraces: false (default)', () => {
		test('click triggering XHR shares trace ID with click span', async ({ recordPage }) => {
			await recordPage.goTo('/separate-traces/click-xhr-default.ejs')
			await recordPage.locator('#btnTriggerXhr').click()

			await recordPage.waitForSpans(
				(spans) => spans.some((span) => span.name === 'click') && spans.filter(isTestXhrSpan).length >= 2,
			)

			const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
			const xhrSpans = recordPage.receivedSpans.filter(isTestXhrSpan)

			expect(clickSpan).toBeDefined()
			expect(xhrSpans.length).toBeGreaterThanOrEqual(2)

			// Each XHR span should have the SAME trace ID as the click span (default behavior)
			for (const xhrSpan of xhrSpans) {
				expect(xhrSpan.traceId).toBe(clickSpan!.traceId)

				// XHR span should have click span as parent
				expect(xhrSpan.parentId).toBe(clickSpan!.id)
			}

			expect(recordPage.receivedErrorSpans).toHaveLength(0)
		})
	})

	test.describe('Fetch with separateTraces: true', () => {
		test('click triggering fetch creates separate traces with parent links', async ({ recordPage }) => {
			await recordPage.goTo('/separate-traces/click-fetch.ejs')
			await recordPage.locator('#btnTriggerFetch').click()

			// Wait for click span and fetch spans
			await recordPage.waitForSpans(
				(spans) =>
					spans.some((span) => span.name === 'click') &&
					spans.filter((span) => span.tags['component'] === 'fetch').length >= 2,
			)

			const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
			const fetchSpans = recordPage.receivedSpans.filter((span) => span.tags['component'] === 'fetch')

			expect(clickSpan).toBeDefined()
			expect(fetchSpans.length).toBeGreaterThanOrEqual(2)

			// Click span should exist with user-interaction component
			expect(clickSpan!.tags['component']).toBe('user-interaction')

			// Each fetch span should have a DIFFERENT trace ID than the click span
			for (const fetchSpan of fetchSpans) {
				expect(fetchSpan.traceId).not.toBe(clickSpan!.traceId)

				// Fetch span should be a root span (no parentId)
				expect(fetchSpan.parentId).toBeUndefined()

				// Verify parent span info is stored as attributes
				expect(fetchSpan.tags['link.interaction.spanId']).toBeDefined()
				expect(fetchSpan.tags['link.interaction.traceId']).toBeDefined()
			}

			// Each fetch span should have a unique trace ID
			const fetchTraceIds = fetchSpans.map((span) => span.traceId)
			const uniqueTraceIds = new Set(fetchTraceIds)
			expect(uniqueTraceIds.size).toBe(fetchSpans.length)

			expect(recordPage.receivedErrorSpans).toHaveLength(0)
		})
	})

	test.describe('Fetch with separateTraces: false (default)', () => {
		test('click triggering fetch shares trace ID with click span', async ({ recordPage }) => {
			await recordPage.goTo('/separate-traces/click-fetch-default.ejs')
			await recordPage.locator('#btnTriggerFetch').click()

			// Wait for click span and fetch spans
			await recordPage.waitForSpans(
				(spans) =>
					spans.some((span) => span.name === 'click') &&
					spans.filter((span) => span.tags['component'] === 'fetch').length >= 2,
			)

			const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
			const fetchSpans = recordPage.receivedSpans.filter((span) => span.tags['component'] === 'fetch')

			expect(clickSpan).toBeDefined()
			expect(fetchSpans.length).toBeGreaterThanOrEqual(2)

			// Each fetch span should have the SAME trace ID as the click span (default behavior)
			for (const fetchSpan of fetchSpans) {
				expect(fetchSpan.traceId).toBe(clickSpan!.traceId)

				// Fetch span should have click span as parent
				expect(fetchSpan.parentId).toBe(clickSpan!.id)
			}

			expect(recordPage.receivedErrorSpans).toHaveLength(0)
		})
	})

	test.describe('Top-level separateTraces: true', () => {
		test('click triggering XHR creates separate traces using top-level config', async ({ recordPage }) => {
			await recordPage.goTo('/separate-traces/click-xhr-toplevel.ejs')
			await recordPage.locator('#btnTriggerXhr').click()

			await recordPage.waitForSpans(
				(spans) => spans.some((span) => span.name === 'click') && spans.filter(isTestXhrSpan).length >= 2,
			)

			const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
			const xhrSpans = recordPage.receivedSpans.filter(isTestXhrSpan)

			expect(clickSpan).toBeDefined()
			expect(xhrSpans.length).toBeGreaterThanOrEqual(2)

			// Each XHR span should have a DIFFERENT trace ID than the click span
			for (const xhrSpan of xhrSpans) {
				expect(xhrSpan.traceId).not.toBe(clickSpan!.traceId)

				// XHR span should be a root span (no parentId)
				expect(xhrSpan.parentId).toBeUndefined()

				// Verify parent span info is stored as attributes
				expect(xhrSpan.tags['link.interaction.spanId']).toBeDefined()
				expect(xhrSpan.tags['link.interaction.traceId']).toBeDefined()
			}

			expect(recordPage.receivedErrorSpans).toHaveLength(0)
		})
	})

	test.describe('Traceparent header propagation', () => {
		test('traceparent header contains XHR span trace ID, not click span trace ID', async ({ recordPage }) => {
			await recordPage.goTo('/separate-traces/click-xhr-traceparent.ejs')
			await recordPage.locator('#btnTriggerXhr').click()

			await recordPage.waitForSpans(
				(spans) => spans.some((span) => span.name === 'click') && spans.some(isTraceparentXhrSpan),
			)

			const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
			const xhrSpan = recordPage.receivedSpans.find(isTraceparentXhrSpan)

			expect(clickSpan).toBeDefined()
			expect(xhrSpan).toBeDefined()

			// Get the traceparent that was sent to the server
			const receivedTraceparent = await recordPage.locator('#result').textContent()

			// traceparent format: 00-{traceId}-{spanId}-01
			// Extract trace ID from traceparent header
			const traceparentMatch = receivedTraceparent?.match(/00-([0-9a-f]{32})-([0-9a-f]{16})-01/)
			expect(traceparentMatch).toBeTruthy()

			const traceparentTraceId = traceparentMatch![1]

			// The traceparent should contain the XHR span's trace ID, NOT the click span's trace ID
			expect(traceparentTraceId).toBe(xhrSpan!.traceId)
			expect(traceparentTraceId).not.toBe(clickSpan!.traceId)

			expect(recordPage.receivedErrorSpans).toHaveLength(0)
		})
	})
})
