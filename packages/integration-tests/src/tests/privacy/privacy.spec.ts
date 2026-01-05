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

type Params = Parameters<typeof test>
type TestFn = Params[2]

const createTestFn: (params: { expectedTargetText: string; path: string }) => TestFn =
	({ expectedTargetText, path }) =>
	async ({ recordPage }) => {
		await recordPage.goTo(path)

		await recordPage.evaluate(() => document.addEventListener('click', () => {}))

		await recordPage.locator('h1').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.tags['event_type'] === 'click'))

		const clickSpan = recordPage.receivedSpans.find((span) => span.tags['event_type'] === 'click')

		expect(clickSpan?.tags['target_text']).toBe(expectedTargetText)
	}

test.describe('Privacy', () => {
	test(
		'privacy.ejs',
		createTestFn({
			expectedTargetText: '<h1>',
			path: '/privacy/privacy.ejs',
		}),
	)

	test(
		'privacy-exclude.ejs',
		createTestFn({
			expectedTargetText: '<h1>',
			path: '/privacy/privacy-exclude.ejs',
		}),
	)

	test(
		'privacy-mask.ejs',
		createTestFn({
			expectedTargetText: '<h1>',
			path: '/privacy/privacy-mask.ejs',
		}),
	)

	test(
		'privacy-mask-all-text-false.ejs',
		createTestFn({
			expectedTargetText: 'Privacy h1',
			path: '/privacy/privacy-mask-all-text-false.ejs',
		}),
	)

	test(
		'privacy-mask-unmask.ejs',
		createTestFn({
			expectedTargetText: 'Privacy h1',
			path: '/privacy/privacy-mask-unmask.ejs',
		}),
	)

	test(
		'privacy-unmask.ejs',
		createTestFn({
			expectedTargetText: 'Privacy h1',
			path: '/privacy/privacy-unmask.ejs',
		}),
	)

	test(
		'privacy-length.ejs',
		createTestFn({
			expectedTargetText: 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu...',
			path: '/privacy/privacy-length.ejs',
		}),
	)
})
