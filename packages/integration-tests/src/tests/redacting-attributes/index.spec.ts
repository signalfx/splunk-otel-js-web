/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
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

test.describe('redacting-attributes', () => {
	test('with custom exporter', async ({ recordPage }) => {
		await recordPage.goTo('/redacting-attributes/index.ejs')

		await recordPage.locator('#btnClick').click()

		await recordPage.waitForSpans((spans) => spans.some((s) => s.name === 'click'))
		const receivedSpans = recordPage.receivedSpans
		const clickSpans = receivedSpans.filter((span) => span.name === 'click')

		expect(clickSpans.every((s) => s.tags['http.url'] === '[redacted]'))
	})
})