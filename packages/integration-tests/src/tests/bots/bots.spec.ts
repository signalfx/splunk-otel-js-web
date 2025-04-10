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

test.describe('Bots - Google bot', () => {
	test.use({
		userAgent:
			'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.92 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	})

	test('Tracking is working for google bot with bots enabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-enabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})

	test('Tracking is not working for google bot with bots disabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-disabled.ejs')
		await recordPage.waitForTimeout(1000)

		expect(recordPage.receivedSpans).toHaveLength(0)
	})
})

test.describe('Bots - Splunk synthetics', () => {
	test.use({
		userAgent:
			'Mozilla/5.0 (Linux; Android 8.0.0; SM-G965U Build/R16NW; Splunk Synthetics) AppleWebKit/537.36 (KHTML, like Gecko)Chrome/127.0.6533.88 Mobile Safari/537.36',
	})

	test('Tracking is working for Splunk Synthetics with bots enabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-enabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})

	test('Tracking is working for Splunk Synthetics with bots disabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-disabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})
})

test.describe('Bots - Real browser - Chrome', () => {
	test.use({
		userAgent:
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
	})

	test('Tracking is working for real browser Chrome with bots enabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-enabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})

	test('Tracking is working for real browser Chrome with bots disabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-disabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})
})

test.describe('Bots - Real browser - Safari', () => {
	test.use({
		userAgent:
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
	})

	test('Tracking is working for real browser Safari with bots enabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-enabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})

	test('Tracking is working for real browser Safari with bots disabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-disabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})
})

test.describe('Bots - Real browser - Firefox', () => {
	test.use({
		userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0',
	})

	test('Tracking is working for real browser Firefox with bots enabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-enabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})

	test('Tracking is working for real browser Firefox with bots disabled', async ({ recordPage }) => {
		await recordPage.goTo('/bots/bots-disabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})
})
