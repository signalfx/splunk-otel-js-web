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

test.describe('visibility', () => {
	test('native session id integration', async ({ recordPage }) => {
		await recordPage.goTo('/visibility/visibility.ejs')
		await recordPage.waitForTimeout(1000)

		await recordPage.changeVisibilityInTab('hidden')
		await recordPage.changeVisibilityInTab('visible')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'visibility').length >= 2)

		const receivedSpans = recordPage.receivedSpans
		const visibilitySpans = receivedSpans.filter((span) => span.name === 'visibility')

		expect(visibilitySpans).toHaveLength(2)
		expect(visibilitySpans[0].tags['hidden']).toBe('true')
		expect(visibilitySpans[1].tags['hidden']).toBe('false')
	})
})
