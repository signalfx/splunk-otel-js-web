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

test.describe('Privacy', () => {
	const testCases = [
		{
			path: '/privacy/privacy.ejs',
			expectedTargetText: undefined,
		},
		{
			path: '/privacy/privacy-exclude.ejs',
			expectedTargetText: undefined,
		},
		{
			path: '/privacy/privacy-mask.ejs',
			expectedTargetText: undefined,
		},
		{
			path: '/privacy/privacy-mask-all-text-false.ejs',
			expectedTargetText: 'Privacy h1',
		},
		{
			path: '/privacy/privacy-mask-unmask.ejs',
			expectedTargetText: 'Privacy h1',
		},
		{
			path: '/privacy/privacy-unmask.ejs',
			expectedTargetText: 'Privacy h1',
		},
	]

	for (const { path, expectedTargetText } of testCases) {
		test(path, async ({ recordPage }) => {
			await recordPage.goTo(path)
			await recordPage.locator('h1').click()

			await recordPage.waitForSpans(
				(spans) => spans.filter((span) => span.tags['event_type'] === 'click').length === 1,
			)

			const clickSpans = recordPage.receivedSpans.filter((span) => span.tags['event_type'] === 'click')

			expect(clickSpans.length).toBe(1)
			expect(clickSpans[0].tags['target_text']).toBe(expectedTargetText)
		})
	}
})
