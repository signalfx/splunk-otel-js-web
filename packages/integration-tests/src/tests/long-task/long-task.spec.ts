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

test.describe('long task', () => {
	test('reports a long task', async ({ recordPage, browserName }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/long-task/index.ejs')

		await recordPage.locator('#btnLongtask').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'longtask').length >= 1)
		const longTaskSpans = recordPage.receivedSpans.filter((span) => span.name === 'longtask')

		expect(longTaskSpans).toHaveLength(1)
		expect(longTaskSpans[0].tags['component']).toBe('splunk-longtask')
		expect(['self', 'unknown'].includes(longTaskSpans[0].tags['longtask.name'] as string)).toBeTruthy()
		expect(longTaskSpans[0].tags['longtask.entry_type']).toBe('longtask')
		expect(longTaskSpans[0].tags['longtask.attribution.name']).toBe('unknown')
		expect(longTaskSpans[0].tags['longtask.attribution.entry_type']).toBe('taskattribution')
		expect(longTaskSpans[0].tags['longtask.attribution.start_time']).toBe('0')
		expect(longTaskSpans[0].tags['longtask.attribution.duration']).toBe('0')
		expect(longTaskSpans[0].tags['longtask.attribution.container_type']).toBe('window')
		expect(longTaskSpans[0].tags['longtask.attribution.container_src']).toBe('')
		expect(longTaskSpans[0].tags['longtask.attribution.container_id']).toBe('')
		expect(longTaskSpans[0].tags['longtask.attribution.container_name']).toBe('')

		const longTaskSpanDuration = parseFloat(longTaskSpans[0].tags['longtask.duration'] as string)
		expect(
			longTaskSpanDuration,
			`Duration (${longTaskSpanDuration}) must be over 50ms by definition.`,
		).toBeGreaterThan(50)
		expect(
			longTaskSpanDuration,
			`Duration (${longTaskSpanDuration}) must be less than 1s by definition.`,
		).toBeLessThan(1000)

		expect(longTaskSpans[0].duration, 'Span duration matches longtask duration').toBe(longTaskSpanDuration * 1000)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('reports buffered longtask', async ({ recordPage, browserName }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/long-task/buffered.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'longtask').length >= 1)
		const longTaskSpans = recordPage.receivedSpans.filter((span) => span.name === 'longtask')

		expect(longTaskSpans).toHaveLength(1)
		const longTaskSpanDuration = parseFloat(longTaskSpans[0].tags['longtask.duration'] as string)
		expect(longTaskSpans[0].duration, 'Span duration matches longtask duration').toBe(longTaskSpanDuration * 1000)
	})

	test('can be disabled', async ({ recordPage, browserName }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo('/long-task/index.ejs?disableInstrumentation=longtask')
		await recordPage.locator('#btnLongtask').click()

		await recordPage.waitForTimeoutAndFlushData(1000)

		const longTaskSpans = recordPage.receivedSpans.filter((span) => span.name === 'longtask')

		expect(longTaskSpans).toHaveLength(0)
	})

	test('longtask will spawn new session', async ({ recordPage, browserName }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo(
			'/long-task/index.ejs?_experimental_longtaskNoStartSession=false&disableInstrumentation=connectivity,document,errors,fetch,interactions,postload,socketio,visibility,websocket,webvitals,xhr',
		)

		await recordPage.locator('#btnLongtask').click()

		const sessionCookie1 = await recordPage.getCookie('_splunk_rum_sid')
		expect(sessionCookie1).toBeTruthy()

		const sessionCookie1Parsed = JSON.parse(decodeURIComponent(sessionCookie1.value))

		await recordPage.waitForTimeoutAndFlushData(1000)

		const allSpans1 = recordPage.receivedSpans

		expect(allSpans1).toHaveLength(1)

		// Set session as expired using expiresAt
		await recordPage.evaluate(
			([expiresAt, id, startTime]) => {
				globalThis[Symbol.for('opentelemetry.js.api.1')]['splunk.rum']['store'].set({
					expiresAt,
					id,
					startTime,
				})
			},
			[Date.now(), sessionCookie1Parsed.id, sessionCookie1Parsed.startTime],
		)

		await recordPage.locator('#btnLongtask').click()

		await recordPage.waitForTimeoutAndFlushData(1000)

		const sessionCookie3 = await recordPage.getCookie('_splunk_rum_sid')
		expect(sessionCookie3).toBeTruthy()

		const allSpans2 = recordPage.receivedSpans
		expect(allSpans2).toHaveLength(2)

		const sessionCookie3Parsed = JSON.parse(decodeURIComponent(sessionCookie3.value))

		expect(sessionCookie1Parsed.id).not.toBe(sessionCookie3Parsed.id)
	})

	test('longtask will not spawn new session', async ({ recordPage, browserName }) => {
		if (browserName === 'webkit' || browserName === 'firefox') {
			test.skip()
		}

		await recordPage.goTo(
			'/long-task/index.ejs?_experimental_longtaskNoStartSession=true&disableInstrumentation=connectivity,document,errors,fetch,interactions,postload,socketio,visibility,websocket,webvitals,xhr',
		)

		await recordPage.locator('#btnLongtask').click()

		const sessionCookie1 = await recordPage.getCookie('_splunk_rum_sid')

		expect(sessionCookie1).toBeTruthy()

		const sessionCookie1Parsed = JSON.parse(decodeURIComponent(sessionCookie1.value))

		await recordPage.waitForTimeoutAndFlushData(1000)

		const allSpans1 = recordPage.receivedSpans

		expect(allSpans1).toHaveLength(1)

		const onlyLongTask = allSpans1[0]

		// Set session as expired using expiresAt
		await recordPage.evaluate(
			([expiresAt, id, startTime]) => {
				globalThis[Symbol.for('opentelemetry.js.api.1')]['splunk.rum']['store'].set({
					expiresAt,
					id,
					startTime,
				})
			},
			[Date.now(), sessionCookie1Parsed.id, sessionCookie1Parsed.startTime],
		)

		await recordPage.waitForTimeout(1000)

		await recordPage.locator('#btnLongtask').click()

		await recordPage.waitForTimeoutAndFlushData(1000)

		const allSpans2 = recordPage.receivedSpans

		expect(allSpans2).toHaveLength(1)

		expect(allSpans2[0].id).toBe(onlyLongTask.id)

		const sessionCookie2 = await recordPage.getCookie('_splunk_rum_sid')

		expect(sessionCookie2).toBeTruthy()

		const sessionCookie2Parsed = JSON.parse(decodeURIComponent(sessionCookie1.value))

		expect(sessionCookie2Parsed.id).toBe(sessionCookie1Parsed.id)
	})
})
