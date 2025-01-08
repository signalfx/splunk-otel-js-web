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
import { generateServerTiming } from '../../server/server-timing'

test.describe('server-timing', () => {
	test('traceId should be attached to documentFetch span if Server-Timing was sent', async ({ recordPage }) => {
		const serverTiming = generateServerTiming()

		const url = new URL('/server-timing/index.ejs', 'http://localhost:3000')
		url.searchParams.set('serverTiming', serverTiming.header)

		await recordPage.goTo(url.toString())

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentFetch').length === 1)
		const documentFetchSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentFetch')

		expect(documentFetchSpans).toHaveLength(1)
		expect(documentFetchSpans[0].tags['link.traceId']).toBe(serverTiming.traceId)
		expect(documentFetchSpans[0].tags['location.href']).toBe(url.toString())

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
