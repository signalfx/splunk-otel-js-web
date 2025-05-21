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
import {
	initSessionTracking,
	getRumSessionId,
	updateSessionStatus,
	getNullableStore,
	SessionState,
} from '../src/session'
import { SESSION_STORAGE_KEY, SESSION_INACTIVITY_TIMEOUT_MS } from '../src/session/constants'
import { expect, it, describe, afterEach, vi, MockInstance } from 'vitest'
import { createWebTracerProvider, deinit } from './utils'
import { SpanProcessor } from '@opentelemetry/sdk-trace-base'

class SessionSpanProcessor implements SpanProcessor {
	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	onEnd(): void {}

	onStart(): void {
		updateSessionStatus({
			forceStore: false,
			hadActivity: true,
		})
	}

	shutdown(): Promise<void> {
		return Promise.resolve()
	}
}

describe('Session tracking', () => {
	it('should correctly handle expiry, garbage values, (in)activity, etc.', async () => {
		// the init tests have possibly already started the setInterval for updateSessionStatus.  Try to accomodate this.
		const trackingHandle = initSessionTracking('cookie', new InternalEventTarget())
		const firstSessionId = getRumSessionId()

		expect(firstSessionId).toHaveLength(32)
		// no marked activity, should keep same state
		updateSessionStatus({ forceStore: false })
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
		trackingHandle.clearSession()
	})
})

describe('Activity tracking', () => {
	let storeSetSpy: MockInstance<(value: SessionState) => void>
	afterEach(() => {
		storeSetSpy.mockRestore()
	})

	function subject(allSpansAreActivity: boolean) {
		const spanProcessors: SessionSpanProcessor[] = []
		if (allSpansAreActivity) {
			spanProcessors.push(new SessionSpanProcessor())
		}

		const provider = createWebTracerProvider({ spanProcessors })

		const handle = initSessionTracking('cookie', new InternalEventTarget(), undefined)
		handle.flush()

		storeSetSpy = vi.spyOn(getNullableStore(), 'set')

		provider.getTracer('tracer').startSpan('any-span').end()
		handle.flush()

		deinit()
	}

	it('non-activity spans do not trigger a new session', () => {
		subject(false)

		expect(storeSetSpy).toHaveBeenCalledTimes(0)
	})

	it('activity spans do trigger a new session when opt-in', () => {
		subject(true)

		expect(storeSetSpy).toHaveBeenCalledTimes(1)
	})
})

describe('Session tracking - localStorage', () => {
	it('should save session state to local storage', () => {
		const trackingHandle = initSessionTracking('localStorage', new InternalEventTarget())

		const firstSessionId = getRumSessionId()
		updateSessionStatus({ forceStore: true })

		expect(firstSessionId).toBe(getRumSessionId())
		expect(JSON.parse(localStorage['_splunk_rum_sid'])['id']).toBe(getRumSessionId())

		trackingHandle.deinit()
		trackingHandle.clearSession()
	})
})
