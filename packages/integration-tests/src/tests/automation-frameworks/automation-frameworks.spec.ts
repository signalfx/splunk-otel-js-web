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

test.describe('Automation frameworks', () => {
	test('Tracking is working for playwright with automation frameworks enabled', async ({ recordPage }) => {
		await recordPage.goTo('/automation-frameworks/automation-frameworks-enabled.ejs')
		await recordPage.waitForSpans((spans) => spans.length > 0)

		expect(recordPage.receivedSpans.length).toBeGreaterThan(0)
	})

	test('Tracking is not working for playwright with automation frameworks disabled', async ({ recordPage }) => {
		await recordPage.goTo('/automation-frameworks/automation-frameworks-disabled.ejs')
		await recordPage.waitForTimeout(1000)

		expect(recordPage.receivedSpans).toHaveLength(0)
	})
})
