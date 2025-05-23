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
import { test } from '../../utils/test'
import { expect } from '@playwright/test'

test.describe('forms', () => {
	test('handles form submit', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/forms.ejs')

		await recordPage.locator('#btnSubmit').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'submit').length === 1)

		const submitSpans = recordPage.receivedSpans.filter((span) => span.name === 'submit')

		expect(submitSpans).toHaveLength(1)
		expect(submitSpans[0].tags['component']).toBe('user-interaction')
		expect(submitSpans[0].tags['event_type']).toBe('submit')
		expect(submitSpans[0].tags['target_element']).toBe('FORM')
		expect(submitSpans[0].tags['target_xpath']).toBe('//*[@id="form1"]')
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
