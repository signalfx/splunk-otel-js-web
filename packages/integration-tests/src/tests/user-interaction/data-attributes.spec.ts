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

test.describe('data attributes capture', () => {
	test('should capture configured data attributes from clicked element', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/data-attributes.ejs')
		await recordPage.locator('#btnWithData').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'click'))
		const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')

		expect(clickSpan).toHaveSpanAttribute('component', 'user-interaction')
		expect(clickSpan).toHaveSpanAttribute('event_type', 'click')

		// Verify configured data attributes are captured (normalized to element.dataset.camelCase format)
		// 'data-testid' (hyphenated config) -> element.dataset.testid
		expect(clickSpan).toHaveSpanAttribute('element.dataset.testid', 'submit-button')
		// 'track' (camelCase config) -> looks up data-track -> element.dataset.track
		expect(clickSpan).toHaveSpanAttribute('element.dataset.track', 'purchase')
		// 'userName' (camelCase config) -> looks up data-user-name -> element.dataset.userName
		expect(clickSpan).toHaveSpanAttribute('element.dataset.userName', 'john-doe')

		// Non-data attributes should not be captured
		expect(clickSpan).toNotHaveSpanAttribute('aria-label')

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
