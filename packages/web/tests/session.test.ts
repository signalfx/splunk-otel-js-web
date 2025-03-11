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

import { InternalEventTarget } from '../src/EventTarget'
import { initSessionTracking, getRumSessionId, updateSessionStatus, setStoreType } from '../src/session'
import { SESSION_STORAGE_KEY, SESSION_INACTIVITY_TIMEOUT_MS } from '../src/session/constants'
import { clearSessionCookie, cookieStore } from '../src/session/cookie-session'
import { clearSessionStateFromLocalStorage } from '../src/session/local-storage-session'
import { expect, it, describe, beforeEach, afterEach, vi, MockInstance } from 'vitest'
import { createWebTracerProvider } from './utils'

describe('Session tracking', () => {
	beforeEach(() => {
		clearSessionCookie()
	})

	afterEach(() => {
		clearSessionCookie()
	})

	it('should correctly handle expiry, garbage values, (in)activity, etc.', async () => {
		// the init tests have possibly already started the setInterval for updateSessionStatus.  Try to accomodate this.
		const provider = createWebTracerProvider()
		const trackingHandle = initSessionTracking(provider, new InternalEventTarget())
		const firstSessionId = getRumSessionId()

		expect(firstSessionId).toHaveLength(32)
		// no marked activity, should keep same state
		updateSessionStatus({ forceStore: false,  })
		expect(firstSessionId).toBe(getRumSessionId())

		// set cookie to expire in 2 seconds, mark activity, and then updateSessionStatus.
		// Wait 4 seconds and cookie should still be there (having been renewed)
		const cookieValue = encodeURIComponent(
			JSON.stringify({
				id: firstSessionId,
				startTime: new Date().getTime(),
				expiresAt: new Date().getTime() + SESSION_INACTIVITY_TIMEOUT_MS,
			}),
		)
		document.cookie = SESSION_STORAGE_KEY + '=' + cookieValue + '; path=/; max-age=' + 2
		document.body.dispatchEvent(new Event('click'))
		updateSessionStatus({ forceStore: false })

		await new Promise((resolve) => setTimeout(resolve, 4000))

		// because of activity, same session should be there
		expect(document.cookie.includes(SESSION_STORAGE_KEY)).toBeTruthy()
		expect(firstSessionId).toBe(getRumSessionId())

		// Finally, set a fake cookie with startTime 5 hours ago, update status, and find a new cookie with a new session ID
		// after max age code does its thing
		const fiveHoursMillis = 5 * 60 * 60 * 1000
		const tooOldCookieValue = encodeURIComponent(
			JSON.stringify({
				id: firstSessionId,
				startTime: new Date().getTime() - fiveHoursMillis,
				expiresAt: new Date().getTime() + SESSION_INACTIVITY_TIMEOUT_MS - fiveHoursMillis,
			}),
		)
		document.cookie = SESSION_STORAGE_KEY + '=' + tooOldCookieValue + '; path=/; max-age=' + 4

		updateSessionStatus({ forceStore: true })
		expect(document.cookie.includes(SESSION_STORAGE_KEY)).toBeTruthy()
		const newSessionId = getRumSessionId()
		expect(newSessionId?.length).toBe(32)
		expect(firstSessionId !== newSessionId).toBeTruthy()

		trackingHandle.deinit()
	})
})

describe.skip('Activity tracking', () => {
	let cookieSetStoreSpy: MockInstance<(value: string) => void>
	beforeEach(() => {
		cookieSetStoreSpy = vi.spyOn(cookieStore, 'set')
	})

	afterEach(() => {
		cookieSetStoreSpy.mockRestore()
	})

	function subject(allSpansAreActivity = false) {
		const provider = createWebTracerProvider()

		initSessionTracking(provider, '1234', new InternalEventTarget(), undefined, allSpansAreActivity)

		provider.getTracer('tracer').startSpan('any-span').end()
		updateSessionStatus({ forceStore: false, useLocalStorage: false })
	}

	it('non-activity spans do not trigger a new session', () => {
		subject()

		expect(cookieSetStoreSpy).toHaveBeenCalledTimes(1)
	})

	it('activity spans do trigger a new session when opt-in', () => {
		subject(true)

		expect(cookieSetStoreSpy).toHaveBeenCalledTimes(2)
	})
})

describe('Session tracking - localStorage', () => {
	beforeEach(() => {
		clearSessionStateFromLocalStorage()
		setStoreType("localStorage");
	})

	afterEach(() => {
		clearSessionStateFromLocalStorage()
		setStoreType(null);
	})

	it('should save session state to local storage', () => {
		const provider = createWebTracerProvider()
		const trackingHandle = initSessionTracking(
			provider,
			new InternalEventTarget(),
			undefined,
			undefined,
		)

		const firstSessionId = getRumSessionId()
		updateSessionStatus({ forceStore: true })
		expect(firstSessionId).toBe(getRumSessionId())

		trackingHandle.deinit()
	})
})
