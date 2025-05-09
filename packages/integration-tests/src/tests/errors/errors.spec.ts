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

test.describe('errors', () => {
	test('DOM resource 4xx', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/resource-4xx.ejs')
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.name === 'eventListener.error').length === 1,
		)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'eventListener.error')

		expect(errorSpans).toHaveLength(1)

		expect(errorSpans[0].tags['component']).toBe('error')
		expect(errorSpans[0].tags['error.type']).toBe('error')
		expect(errorSpans[0].tags['target_element']).toBe('IMG')
		expect(errorSpans[0].tags['target_xpath']).toBe('//html/body/img')
		expect(
			(errorSpans[0].tags['target_src'] as string).endsWith('/nonexistent.png'),
			`Checking target_src: ${errorSpans[0]['target_src']}`,
		).toBeTruthy()
	})

	test('JS syntax error', async ({ recordPage, browserName }) => {
		await recordPage.goTo('/errors/views/js-syntax-error.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans).toHaveLength(1)

		expect(errorSpans[0].tags['component']).toBe('error')
		expect(errorSpans[0].tags['error']).toBe('true')
		expect(errorSpans[0].tags['error.object']).toBe('SyntaxError')

		const errorMessageMap = {
			chromium: "Unexpected token ';'",
			firefox: "expected expression, got ';'",
			webkit: "Unexpected token ';'",
		}

		expect(errorSpans[0].tags['error.message']).toBe(errorMessageMap[browserName])
	})

	test('JS unhandled error', async ({ recordPage, browserName }) => {
		await recordPage.goTo('/errors/views/unhandled-error.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans).toHaveLength(1)

		expect(errorSpans[0].tags['component']).toBe('error')
		expect(errorSpans[0].tags['error']).toBe('true')
		expect(errorSpans[0].tags['error.object']).toBe('TypeError')

		const errorMessageMap = {
			chromium: "Cannot set properties of null (setting 'prop1')",
			firefox: 'test is null',
			webkit: "null is not an object (evaluating 'test.prop1 = true')",
		}

		expect(errorSpans[0].tags['error.message']).toBe(errorMessageMap[browserName])
	})

	test('unhandled promise rejection', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/unhandled-rejection.ejs')
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.name === 'unhandledrejection').length === 1,
		)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'unhandledrejection')

		expect(errorSpans).toHaveLength(1)
		expect(errorSpans[0].tags['component']).toBe('error')
		expect(errorSpans[0].tags['error']).toBe('true')
		expect(errorSpans[0].tags['error.object']).toBe('String')
		expect(errorSpans[0].tags['error.message']).toBe('rejection-value')
	})

	test('manual console.error', async ({ recordPage, browserName }) => {
		await recordPage.goTo('/errors/views/console-error.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'console.error').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'console.error')

		expect(errorSpans).toHaveLength(1)
		expect(errorSpans[0].tags['component']).toBe('error')
		expect(errorSpans[0].tags['error']).toBe('true')
		expect(errorSpans[0].tags['error.object']).toBe('TypeError')

		const errorMessageMap = {
			chromium: "Cannot set properties of null (setting 'anyField')",
			firefox: 'someNull is null',
			webkit: "null is not an object (evaluating 'someNull.anyField = 'value'')",
		}

		expect(errorSpans[0].tags['error.message']).toBe(errorMessageMap[browserName])
	})

	test('SplunkRum.error', async ({ recordPage, browserName }) => {
		const url = 'http://localhost:3000/errors/views/splunkrum-error.ejs'
		await recordPage.goTo(url)
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'SplunkRum.error').length === 1)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'SplunkRum.error')

		expect(errorSpans).toHaveLength(1)
		expect(errorSpans[0].tags['component']).toBe('error')
		expect(errorSpans[0].tags['error']).toBe('true')
		expect(errorSpans[0].tags['error.object']).toBe('TypeError')

		const errorMessages = {
			chromium: "Cannot set properties of null (setting 'anyField')",
			firefox: 'someNull is null',
			webkit: "null is not an object (evaluating 'someNull.anyField = 'value'')",
		}

		expect(errorSpans[0].tags['error.message']).toBe(errorMessages[browserName])

		const errorStackMap = {
			chromium: `TypeError: Cannot set properties of null (setting 'anyField')\n    at ${url}:78:25`,
			firefox: `@${url}:78:7\n`,
			webkit: `global code@${url}:78:15`,
		}

		expect(errorSpans[0].tags['error.stack']).toBe(errorStackMap[browserName])
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
		expect(errorSpans[0].tags['error.message']).toBe('Error from script1.js')
		expect((errorSpans[0].tags['error.source_map_ids'] as string).includes('script1.min.js')).toBeTruthy()
		expect(
			(errorSpans[0].tags['error.source_map_ids'] as string).includes(
				'9663c60664c425cef3b141c167e9b324240ce10ae488726293892b7130266a6b',
			),
		).toBeTruthy()

		await recordPage.locator('#button2').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 2)
		const errorSpans2 = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans2).toHaveLength(2)
		expect(errorSpans2[1].tags['error.message']).toBe('Error from script2.js')
		expect((errorSpans2[1].tags['error.source_map_ids'] as string).includes('script2.min.js')).toBeTruthy()
		expect(
			(errorSpans2[1].tags['error.source_map_ids'] as string).includes(
				'9793573cdc2ab308a0b1996bea14253ec8832bc036210475ded0813cafa27066',
			),
		).toBeTruthy()

		await recordPage.locator('#button3').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onerror').length === 3)
		const errorSpans3 = recordPage.receivedSpans.filter((span) => span.name === 'onerror')

		expect(errorSpans3).toHaveLength(3)
		expect(errorSpans3[2].tags['error.message']).toContain('thisFunctionDoesNotExist') // browsers report the exact error message differently in this scenario
		expect(errorSpans3[2].tags['error.source_map_ids'] as string).toContain(
			'http://localhost:3000/build-plugins-test-project-artifacts/webpack-config-devtool-source-map-js/main.js',
		)
		expect(
			errorSpans3[2].tags['error.source_map_ids'] as string,
			'this expect must be kept in-sync with the sourceMapId injected into build-plugins/integration-test/project/dist/webpack-config-devtool-source-map-js/main.js',
		).toContain('ab2a6548-e5d2-9d1a-fa76-1db1692955bc')
	})

	test('module error', async ({ recordPage }) => {
		await recordPage.goTo('/errors/views/module-error.ejs')
		await recordPage.waitForTimeoutAndFlushData(1000)
		const errorSpans = recordPage.receivedSpans.filter((span) => span.name === 'unhandledrejection')

		expect(errorSpans).toHaveLength(0)
		// As error message is generic [object Module], it is being dropped
		// expect(errorSpans[0].tags['error.message']).toBe('[object Module]')
	})
})
