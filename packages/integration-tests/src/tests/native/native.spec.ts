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

import type { RecordPage } from '../../pages/record-page'

import { test } from '../../utils/test'

const waitForSessionId = async (recordPage: RecordPage, sessionId: string | undefined) => {
	await expect
		.poll(() => recordPage.evaluate(() => (window as any).SplunkRum.getSessionId()), { timeout: 5000 })
		.toBe(sessionId)
}

const startSpan = async (recordPage: RecordPage, name: string) => {
	await recordPage.evaluate((spanName) => {
		;(window as any).SplunkRum.provider.getTracer('native-session-tests').startSpan(spanName).end()
	}, name)
}

const listenForSessionChanges = async (recordPage: RecordPage) => {
	await recordPage.evaluate(() => {
		const windowWithTestState = window as any
		windowWithTestState.__nativeSessionChanges = []
		windowWithTestState.SplunkRum.addEventListener('session-changed', ({ payload }: any) => {
			const sessionId = payload.sessionId
			windowWithTestState.__nativeSessionChanges.push(`${typeof sessionId}:${String(sessionId)}`)
		})
	})
}

const waitForSessionChange = async (recordPage: RecordPage, expectedSessionId: string) => {
	await expect
		.poll(
			() =>
				recordPage.evaluate(
					(sessionId) => (window as any).__nativeSessionChanges.includes(sessionId),
					expectedSessionId,
				),
			{ timeout: 5000 },
		)
		.toBe(true)
}

test.describe('native bridge', () => {
	test('uses the bridge session ID available at initialization', async ({ recordPage }) => {
		const mobileSessionId = 'native-session-id-at-startup'
		await recordPage.goTo(`/native/native-bridge.ejs?sessionId=${mobileSessionId}`)

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'documentFetch'))

		expect(await recordPage.evaluate(() => (window as any).SplunkRum.getSessionId())).toBe(mobileSessionId)
		expect(
			recordPage.receivedSpans.every((span) => span.attributes['splunk.rumSessionId'] === mobileSessionId),
		).toBe(true)
	})

	test('adopts a bridge session ID that becomes available after initialization', async ({ recordPage }) => {
		await recordPage.goTo('/native/native-bridge.ejs')
		expect(await recordPage.evaluate(() => (window as any).SplunkRum.getSessionId())).toBeUndefined()
		await listenForSessionChanges(recordPage)

		const noSessionSpanName = 'span-with-undefined-native-session-before-adoption'
		await startSpan(recordPage, noSessionSpanName)
		await recordPage.waitForTimeoutAndFlushData(300)
		expect(recordPage.receivedSpans.some((span) => span.name === noSessionSpanName)).toBe(false)

		const mobileSessionId = 'native-session-id-arrived-later'
		await recordPage.evaluate((sessionId) => {
			;(window as any).__setNativeSessionIdForTest(sessionId)
		}, mobileSessionId)
		await waitForSessionChange(recordPage, `string:${mobileSessionId}`)
		await waitForSessionId(recordPage, mobileSessionId)

		const spanName = 'span-with-late-native-session'
		await startSpan(recordPage, spanName)
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === spanName))

		expect(recordPage.receivedSpans.find((span) => span.name === spanName)?.attributes['splunk.rumSessionId']).toBe(
			mobileSessionId,
		)
	})

	test('does not export spans while the bridge session ID is empty or undefined', async ({ recordPage }) => {
		await recordPage.goTo('/native/native-bridge.ejs?sessionId=')
		expect(await recordPage.evaluate(() => (window as any).SplunkRum.getSessionId())).toBe('')

		const emptySessionSpanName = 'span-with-empty-native-session'
		await startSpan(recordPage, emptySessionSpanName)
		await recordPage.waitForTimeoutAndFlushData(300)
		expect(recordPage.receivedSpans.some((span) => span.name === emptySessionSpanName)).toBe(false)

		await recordPage.evaluate(() => {
			;(window as any).__setNativeSessionIdForTest('__undefined__')
		})
		await expect
			.poll(() => recordPage.evaluate(() => (window as any).SplunkRum.getSessionId()), { timeout: 5000 })
			.toBeUndefined()
		await recordPage.waitForTimeout(1100)

		const undefinedSessionSpanName = 'span-with-undefined-native-session'
		await startSpan(recordPage, undefinedSessionSpanName)
		await recordPage.waitForTimeoutAndFlushData(300)
		expect(recordPage.receivedSpans.some((span) => span.name === undefinedSessionSpanName)).toBe(false)
	})

	test('does not export spans during an empty session ID gap, then resumes with the next ID', async ({ recordPage }) => {
		const initialSessionId = 'native-session-before-empty-gap'
		await recordPage.goTo(`/native/native-bridge.ejs?sessionId=${initialSessionId}`)
		await listenForSessionChanges(recordPage)

		const initialSpanName = 'span-before-empty-native-session-gap'
		await startSpan(recordPage, initialSpanName)
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === initialSpanName))
		expect(
			recordPage.receivedSpans.find((span) => span.name === initialSpanName)?.attributes['splunk.rumSessionId'],
		).toBe(initialSessionId)

		await recordPage.evaluate(() => {
			;(window as any).__setNativeSessionIdForTest('')
		})
		await waitForSessionChange(recordPage, 'string:')

		const gapSpanName = 'span-with-empty-native-session-between-valid-IDs'
		await startSpan(recordPage, gapSpanName)
		await recordPage.waitForTimeoutAndFlushData(300)
		expect(recordPage.receivedSpans.some((span) => span.name === gapSpanName)).toBe(false)

		const restoredSessionId = 'native-session-after-empty-gap'
		await recordPage.evaluate((sessionId) => {
			;(window as any).__setNativeSessionIdForTest(sessionId)
		}, restoredSessionId)
		await waitForSessionChange(recordPage, `string:${restoredSessionId}`)
		await waitForSessionId(recordPage, restoredSessionId)

		const restoredSpanName = 'span-after-empty-native-session-gap'
		await startSpan(recordPage, restoredSpanName)
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === restoredSpanName))
		expect(
			recordPage.receivedSpans.find((span) => span.name === restoredSpanName)?.attributes['splunk.rumSessionId'],
		).toBe(restoredSessionId)
	})

	test('starts with an empty session ID, drops spans, then exports with the first ID', async ({ recordPage }) => {
		await recordPage.goTo('/native/native-bridge.ejs?sessionId=')
		expect(await recordPage.evaluate(() => (window as any).SplunkRum.getSessionId())).toBe('')
		await listenForSessionChanges(recordPage)

		const emptySessionSpanName = 'span-with-empty-native-session-at-start'
		await startSpan(recordPage, emptySessionSpanName)
		await recordPage.waitForTimeoutAndFlushData(300)
		expect(recordPage.receivedSpans.some((span) => span.name === emptySessionSpanName)).toBe(false)

		const firstSessionId = 'native-session-after-empty-start'
		await recordPage.evaluate((sessionId) => {
			;(window as any).__setNativeSessionIdForTest(sessionId)
		}, firstSessionId)
		await waitForSessionChange(recordPage, `string:${firstSessionId}`)
		await waitForSessionId(recordPage, firstSessionId)

		const spanName = 'span-after-empty-native-session-start'
		await startSpan(recordPage, spanName)
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === spanName))
		expect(recordPage.receivedSpans.find((span) => span.name === spanName)?.attributes['splunk.rumSessionId']).toBe(
			firstSessionId,
		)
	})
})
