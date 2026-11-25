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

const PAGE = '/session-recorder/idle-callback.ejs'
const PAGE_WITHOUT_NATIVE_IDLE_CALLBACK = `${PAGE}?withoutNativeIdleCallback`

type WorkloadResult = { elapsedMs: number; ran: number }

test.describe('session recorder: requestIdleCallback', () => {
	test('keeps the native requestIdleCallback in browsers that provide one', async ({ browserName, recordPage }) => {
		test.skip(browserName === 'webkit', 'Safari has no native requestIdleCallback')

		await recordPage.goTo(PAGE)

		const isNative = await recordPage.evaluate(() =>
			Function.prototype.toString.call(window.requestIdleCallback).includes('[native code]'),
		)
		expect(isNative).toBe(true)
	})

	test('installs the bounded polyfill when the browser has no requestIdleCallback', async ({ recordPage }) => {
		await recordPage.goTo(PAGE_WITHOUT_NATIVE_IDLE_CALLBACK)

		const isPolyfill = await recordPage.evaluate(
			() =>
				(window.requestIdleCallback as unknown as Record<string, unknown> | undefined)?.[
					'__splunkIdleCallbackPolyfill'
				] === true,
		)
		expect(isPolyfill).toBe(true)
	})

	test('runs idle callbacks registered without a timeout on a busy page', async ({ recordPage }) => {
		await recordPage.goTo(PAGE_WITHOUT_NATIVE_IDLE_CALLBACK)

		const result = await recordPage.evaluate<WorkloadResult>(() =>
			(
				window as unknown as { runIdleCallbacksOnBusyPage: (count: number) => Promise<WorkloadResult> }
			).runIdleCallbacksOnBusyPage(500),
		)

		// Registration takes about 1 s and the polyfill runs every callback within 1 s of being registered;
		// 5 s leaves headroom for slow CI machines.
		expect(result.ran).toBe(500)
		expect(result.elapsedMs).toBeLessThan(5000)
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('still records and uploads session replay data with the polyfill', async ({ recordPage }) => {
		await recordPage.goTo(PAGE_WITHOUT_NATIVE_IDLE_CALLBACK)
		await recordPage.locator('#btn').click()

		const countReplayUploads = () =>
			recordPage.evaluate(
				() =>
					performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/api/v1/rumreplay'))
						.length,
			)
		await expect.poll(countReplayUploads, { timeout: 30_000 }).toBeGreaterThan(0)
	})
})
