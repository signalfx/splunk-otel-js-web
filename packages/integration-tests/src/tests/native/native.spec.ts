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

test.describe('native', () => {
	test('native session id integration', async ({ recordPage }) => {
		await recordPage.goTo('/native/native.ejs')

		await recordPage.waitForSpans((spans) => spans.some((s) => s.name === 'documentFetch'))
		const receivedSpans = recordPage.receivedSpans

		expect(
			receivedSpans.every((span) => span.tags['splunk.rumSessionId'] === '12341234123412341234123412341234'),
		).toBe(true)
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
