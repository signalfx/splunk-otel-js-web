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
import type { ExportedTestSpan } from '@test-utils/test-span.js'

import { test } from '../../utils/test'

test.describe('errors', () => {
	test('DOM resource 4xx', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/resource-4xx.ejs')
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.name === 'eventListener.error').length === 1,
		)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'eventListener.error')

		expect(errorSpans).toHaveLength(1)

		expect(errorSpans[0]).toHaveSpanAttribute('component', 'error')
		expect(errorSpans[0]).toHaveSpanAttribute('error.type', 'error')
		expect(errorSpans[0]).toHaveSpanAttribute('target_element', 'IMG')
		expect(errorSpans[0]).toHaveSpanAttribute('target_xpath', '//html/body/img')
		expect(errorSpans[0]).toHaveSpanAttributeEndingWith('target_src', '/nonexistent.png')
		expect(errorSpans[0]).toHaveSpanAttribute('error.message', 'Failed to load <img src="/nonexistent.png" />')
	})

	test('JS syntax error', async ({ browserName, recordPage }) => {
		await recordPage.goTo('/errors/views/js-syntax-error.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans).toHaveLength(1)

		expect(errorSpans[0]).toHaveSpanAttribute('component', 'error')
		expect(errorSpans[0]).toHaveSpanAttribute('error', true)
		expect(errorSpans[0]).toHaveSpanAttribute('error.object', 'SyntaxError')

		const errorMessageMap = {
			chromium: "Unexpected token ';'",
			firefox: "expected expression, got ';'",
			webkit: "Unexpected token ';'",
		}

		expect(errorSpans[0]).toHaveSpanAttribute('error.message', errorMessageMap[browserName])
	})

	test('JS unhandled error', async ({ browserName, recordPage }) => {
		await recordPage.goTo('/errors/views/unhandled-error.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans).toHaveLength(1)

		expect(errorSpans[0]).toHaveSpanAttribute('component', 'error')
		expect(errorSpans[0]).toHaveSpanAttribute('error', true)
		expect(errorSpans[0]).toHaveSpanAttribute('error.object', 'TypeError')

		const errorMessageMap = {
			chromium: "Cannot set properties of null (setting 'prop1')",
			firefox: 'can\'t access property "prop1", test is null',
			webkit: "null is not an object (evaluating 'test.prop1 = true')",
		}

		expect(errorSpans[0]).toHaveSpanAttribute('error.message', errorMessageMap[browserName])
	})

	test('unhandled promise rejection', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/unhandled-rejection.ejs')
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.name === 'unhandledrejection').length === 1,
		)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'unhandledrejection')

		expect(errorSpans).toHaveLength(1)
		expect(errorSpans[0]).toHaveSpanAttribute('component', 'error')
		expect(errorSpans[0]).toHaveSpanAttribute('error', true)
		expect(errorSpans[0]).toHaveSpanAttribute('error.object', 'String')
		expect(errorSpans[0]).toHaveSpanAttribute('error.message', 'rejection-value')
	})

	test('manual console.error', async ({ browserName, recordPage }) => {
		await recordPage.goTo('/errors/views/console-error.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'console.error').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'console.error')

		expect(errorSpans).toHaveLength(1)
		expect(errorSpans[0]).toHaveSpanAttribute('component', 'error')
		expect(errorSpans[0]).toHaveSpanAttribute('error', true)
		expect(errorSpans[0]).toHaveSpanAttribute('error.object', 'TypeError')
		expect(errorSpans[0]).toNotHaveSpanAttribute('splunkContext')
		expect(errorSpans[0]).toHaveSpanAttribute('errorValueString', 'errorValue')
		expect(errorSpans[0]).toHaveSpanAttribute('errorValueNumber', 123)

		const errorMessageMap = {
			chromium: "Cannot set properties of null (setting 'anyField')",
			firefox: 'can\'t access property "anyField", someNull is null',
			webkit: "null is not an object (evaluating 'someNull.anyField = 'value'')",
		}

		expect(errorSpans[0]).toHaveSpanAttribute('error.message', errorMessageMap[browserName])
	})

	test('SplunkRum.reportError', async ({ browserName, recordPage }) => {
		const url = 'http://localhost:3000/errors/views/splunkrum-reporterror.ejs'
		await recordPage.goTo(url)
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.name === 'SplunkRum.reportError').length === 1,
		)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'SplunkRum.reportError')

		expect(errorSpans).toHaveLength(1)
		expect(errorSpans[0]).toHaveSpanAttribute('component', 'error')
		expect(errorSpans[0]).toHaveSpanAttribute('error', true)
		expect(errorSpans[0]).toHaveSpanAttribute('error.object', 'TypeError')
		expect(errorSpans[0]).toNotHaveSpanAttribute('splunkContext')
		expect(errorSpans[0]).toHaveSpanAttribute('errorValueString', 'errorValueContext')
		expect(errorSpans[0]).toHaveSpanAttribute('errorValueNumber', 321)

		const errorMessages = {
			chromium: "Cannot set properties of null (setting 'anyField')",
			firefox: 'can\'t access property "anyField", someNull is null',
			webkit: "null is not an object (evaluating 'someNull.anyField = 'value'')",
		}

		expect(errorSpans[0]).toHaveSpanAttribute('error.message', errorMessages[browserName])

		const errorStackMap = {
			chromium: `TypeError: Cannot set properties of null (setting 'anyField')\n    at ${url}:78:25`,
			firefox: `@${url}:78:7\n`,
			webkit: `global code@${url}:78:15`,
		}

		expect(errorSpans[0]).toHaveSpanAttribute('error.stack', errorStackMap[browserName])
	})

	test('module can be disabled', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/unhandled-error.ejs?disableInstrumentation=errors')
		await recordPage.waitForTimeoutAndFlushData(1000)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans).toHaveLength(0)
	})

	test('minified script with source map id', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/minified-file-errors.ejs')
		await recordPage.locator('#button1').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans).toHaveLength(1)
		expect(errorSpans[0]).toHaveSpanAttribute('error.message', 'Error from script1.js')
		expect(errorSpans[0]).toHaveSpanAttributeContaining('error.source_map_ids', 'script1.min.js')
		expect(errorSpans[0]).toHaveSpanAttributeContaining(
			'error.source_map_ids',
			'9663c60664c425cef3b141c167e9b324240ce10ae488726293892b7130266a6b',
		)

		await recordPage.locator('#button2').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 2)
		const errorSpans2 = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans2).toHaveLength(2)
		expect(errorSpans2[1]).toHaveSpanAttribute('error.message', 'Error from script2.js')
		expect(errorSpans2[1]).toHaveSpanAttributeContaining('error.source_map_ids', 'script2.min.js')
		expect(errorSpans2[1]).toHaveSpanAttributeContaining(
			'error.source_map_ids',
			'9793573cdc2ab308a0b1996bea14253ec8832bc036210475ded0813cafa27066',
		)

		await recordPage.locator('#button3').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 3)
		const errorSpans3 = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans3).toHaveLength(3)
		expect(errorSpans3[2]).toHaveSpanAttributeContaining('error.message', 'thisFunctionDoesNotExist')
		expect(errorSpans3[2]).toHaveSpanAttributeContaining(
			'error.source_map_ids',
			'http://localhost:3000/build-plugins-test-project-artifacts/webpack-config-devtool-source-map-js/main.js',
		)
		expect(errorSpans3[2]).toHaveSpanAttributeContaining(
			'error.source_map_ids',
			'2899acdb-3e6b-b5bd-66c7-59949666821b',
		)
	})

	test('module error', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/module-error.ejs')
		await recordPage.waitForTimeoutAndFlushData(1000)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'unhandledrejection')

		expect(errorSpans).toHaveLength(0)
		// As error message is generic [object Module], it is being dropped
	})

	test('throttling error spans', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/throttling.ejs')
		await recordPage.waitForTimeoutAndFlushData(1500)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.attributes['component'] === 'error')
		const groupedSpans: ExportedTestSpan[][] = Object.values(
			errorSpans.reduce(
				(acc, span) => {
					const key = JSON.stringify(span.attributes)
					if (!acc[key]) {
						acc[key] = []
					}

					acc[key].push(span)
					return acc
				},
				{} as Record<string, typeof errorSpans>,
			),
		)

		// There should be less than 15 spans, as throttling is set to 500ms
		// but to prevent flakiness, we allow up to 20 spans
		// in case the test is run on a slow machine
		expect(Object.keys(groupedSpans).length).toBeLessThan(20)
		for (const group of groupedSpans) {
			const timestamps = group
				.map((span) => {
					const startNanos = BigInt(span.startTime[0]) * 1_000_000_000n + BigInt(span.startTime[1])
					return Number(startNanos / 1000n)
				})
				.toSorted((a, b) => a - b)
			for (let i = 1; i < timestamps.length; i++) {
				expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(1000)
			}
		}
	})
})
