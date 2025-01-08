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

test.describe('connectivity', () => {
	test('Connectivity events are captured', async ({ browserName, recordPage }) => {
		if (browserName === 'firefox') {
			// TODO: Investigate why setOffline is not working in firefox
			test.skip()
		}

		await recordPage.goTo('/connectivity/connectivity.ejs')

		await recordPage.waitForSpans((spans) => spans.some((s) => s.name === 'documentFetch'))

		// Wait some time to see if we get any connectivity spans
		await recordPage.waitForTimeoutAndFlushData(1000)
		const connectivitySpansBeforeOffline = recordPage.receivedSpans.filter((span) => span.name === 'connectivity')

		expect(connectivitySpansBeforeOffline.length).toBe(0)

		await recordPage.setOffline()

		await recordPage.waitForTimeoutAndFlushData(1000)
		const connectivitySpansAfterOffline = recordPage.receivedSpans.filter((span) => span.name === 'connectivity')

		expect(connectivitySpansAfterOffline.length).toBe(0)

		await recordPage.setOnline()
		await recordPage.waitForSpans((spans) => spans.filter((s) => s.name === 'connectivity').length >= 1)
		const connectivitySpansAfterOnline = recordPage.receivedSpans.filter((span) => span.name === 'connectivity')

		expect(connectivitySpansAfterOnline).toHaveLength(2)
		expect(connectivitySpansAfterOnline[0].tags['online']).toBe('false')
		expect(connectivitySpansAfterOnline[1].tags['online']).toBe('true')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)

		await recordPage.setOffline()
		await recordPage.setOnline()

		await recordPage.waitForSpans((spans) => spans.filter((s) => s.name === 'connectivity').length >= 4)
		const allConnectivitySpans = recordPage.receivedSpans.filter((span) => span.name === 'connectivity')

		expect(allConnectivitySpans).toHaveLength(4)
		expect(allConnectivitySpans[2].tags['online']).toBe('false')
		expect(allConnectivitySpans[3].tags['online']).toBe('true')
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
