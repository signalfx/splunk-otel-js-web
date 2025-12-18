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

test.describe('data attributes capture', () => {
	test('should capture configured data attributes from clicked element', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/data-attributes.ejs')
		await recordPage.locator('#btnWithData').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'click'))
		const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')

		expect(clickSpan?.tags['component']).toBe('user-interaction')
		expect(clickSpan?.tags['event_type']).toBe('click')

		// Verify configured data attributes are captured
		expect(clickSpan?.tags['data-testid']).toBe('submit-button')
		expect(clickSpan?.tags['data-track']).toBe('purchase')

		// Non-data attributes should not be captured
		expect(clickSpan?.tags['aria-label']).toBeUndefined()

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
