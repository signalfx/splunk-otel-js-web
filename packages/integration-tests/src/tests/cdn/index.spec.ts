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

test.describe('cdn', () => {
	test('JS unhandled error', async ({ browserName, recordPage }) => {
		await recordPage.goTo('/cdn/index.ejs')

		await recordPage.waitForSpans((spans) => spans.some((s) => s.name === 'onerror'))
		const errorSpans = recordPage.receivedSpans.filter((s) => s.name === 'onerror')

		expect(errorSpans).toHaveLength(1)

		const errorSpan = errorSpans[0]
		expect(errorSpan.tags['component']).toBe('error')
		expect(errorSpan.tags['error']).toBe('true')
		expect(errorSpan.tags['error.object']).toBe('TypeError')

		let expectedMessage = ''

		switch (browserName) {
			case 'chromium':
				expectedMessage = "Cannot set properties of null (setting 'prop1')"
				break
			case 'firefox':
				expectedMessage = 'test is null'
				break
			case 'webkit':
				expectedMessage = "null is not an object (evaluating 'test.prop1 = true')"
				break
		}

		expect(errorSpan.tags['error.message']).toBe(expectedMessage)

		const rumScriptFetchSpans = recordPage.receivedSpans.filter(
			(s) => s.name === 'resourceFetch' && (<string>s.tags['http.url']).includes('cdn.signalfx.com'),
		)
		expect(rumScriptFetchSpans).toHaveLength(1)
		const rumScriptFetchSpan = rumScriptFetchSpans[0]
		expect(rumScriptFetchSpan.tags['http.url']).toBe(
			'https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js',
		)
		expect(rumScriptFetchSpan.tags['splunk.rumVersion']).toBe('0.22.0')
	})
})
