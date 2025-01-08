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

test.describe('web vitals', () => {
	test('web vitals spans', async ({ recordPage, browserName }) => {
		// TODO: Investigate why this test is disabled on webkit and firefox
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals.ejs')

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		// webvitals library won't send the cls unless a visibility change happens, so
		// force a fake one
		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const lcp = recordPage.receivedSpans.filter((span) => span.tags.lcp !== undefined)
		expect(lcp).toHaveLength(1)

		const cls = recordPage.receivedSpans.filter((span) => span.tags.cls !== undefined)
		expect(cls).toHaveLength(1)

		const fid = recordPage.receivedSpans.filter((span) => span.tags.fid !== undefined)
		const inp = recordPage.receivedSpans.filter((span) => span.tags.inp !== undefined)

		if (fid.length > 0) {
			expect(fid[0].name).toBe('webvitals')
		}

		if (inp.length > 0) {
			expect(inp[0].name).toBe('webvitals')
		}

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('webvitals - specific metrics disabled', async ({ recordPage, browserName }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/webvitals/webvitals-specific-disabled.ejs')

		await recordPage.locator('#clicky').click()
		await expect(recordPage.locator('#p2')).toBeAttached()

		// webvitals library won't send the cls unless a visibility change happens, so
		// force a fake one
		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.waitForTimeoutAndFlushData(1000)

		const lcp = recordPage.receivedSpans.filter((span) => span.tags.lcp !== undefined)
		const cls = recordPage.receivedSpans.filter((span) => span.tags.cls !== undefined)

		expect(lcp).toHaveLength(0)
		expect(cls).toHaveLength(0)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
