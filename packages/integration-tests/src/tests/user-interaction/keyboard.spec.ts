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

test.describe('keyboard', () => {
	test('handles keyboard events', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/keyboard.ejs')
		await recordPage.locator('body').type('a')

		// TODO: Two keydown spans are being created. Investigate why.
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'keydown'))
		const keydownSpan = recordPage.receivedSpans.find((span) => span.name === 'keydown')

		expect(keydownSpan).toHaveSpanAttribute('component', 'user-interaction')
		expect(keydownSpan).toHaveSpanAttribute('event_type', 'keydown')
		expect(keydownSpan).toHaveSpanAttribute('target_element', 'BODY')
		expect(keydownSpan).toHaveSpanAttribute('target_xpath', '//html/body')
	})
})
