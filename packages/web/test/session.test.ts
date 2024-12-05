/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import * as assert from 'assert'
import { InternalEventTarget } from '../src/EventTarget'
import { SplunkWebTracerProvider } from '../src'
import sinon from 'sinon'
import { SessionService, SessionProvider } from '../src/services/session-service'
import { StorageService } from '../src/services/storage-service'
import { SplunkOtelWebConfig } from '../src/types'
import { ActivityService } from '../src/services/activity-service'
import { beforeEach } from 'mocha'
import { CookieStorage } from '../src/services/storage-service/cookie-storage'
import { LocalStorage } from '../src/services/storage-service/local-storage'

describe('Session tracking', () => {
	let storageService: StorageService

	beforeEach(() => {
		storageService = new StorageService({})
		storageService.clearSessionData()
	})

	afterEach(() => {
		storageService.clearSessionData()
	})

	it.skip('should correctly handle expiry, garbage values, (in)activity, etc.', () => {
		// the init tests have possibly already started the setInterval for updateSessionStatus.  Try to accomodate this.
		// const provider = new SplunkWebTracerProvider()
		// const trackingHandle = initSessionTracking(provider, '1234', new InternalEventTarget())
		// const firstSessionId = getRumSessionId()
		// assert.strictEqual(firstSessionId.length, 32)
		// // no marked activity, should keep same state
		// updateSessionStatus()
		// assert.strictEqual(firstSessionId, getRumSessionId())
		// // set cookie to expire in 2 seconds, mark activity, and then updateSessionStatus.
		// // Wait 4 seconds and cookie should still be there (having been renewed)
		// const cookieValue = encodeURIComponent(JSON.stringify({ id: firstSessionId, startTime: new Date().getTime() }))
		// document.cookie = COOKIE_NAME + '=' + cookieValue + '; path=/; max-age=' + 2
		// document.body.dispatchEvent(new Event('click'))
		// updateSessionStatus()
		// setTimeout(() => {
		// 	// because of activity, same session should be there
		// 	assert.ok(document.cookie.includes(COOKIE_NAME))
		// 	assert.strictEqual(firstSessionId, getRumSessionId())
		//
		// 	// Finally, set a fake cookie with startTime 5 hours ago, update status, and find a new cookie with a new session ID
		// 	// after max age code does its thing
		// 	const fiveHoursMillis = 5 * 60 * 60 * 1000
		// 	const tooOldCookieValue = encodeURIComponent(
		// 		JSON.stringify({ id: firstSessionId, startTime: new Date().getTime() - fiveHoursMillis }),
		// 	)
		// 	document.cookie = COOKIE_NAME + '=' + tooOldCookieValue + '; path=/; max-age=' + 4
		//
		// 	updateSessionStatus()
		// 	assert.ok(document.cookie.includes(COOKIE_NAME))
		// 	const newSessionId = getRumSessionId()
		// 	assert.strictEqual(newSessionId.length, 32)
		// 	assert.ok(firstSessionId !== newSessionId)
		//
		// 	trackingHandle.deinit()
		// 	done()
		// }, 4000)
	})

	describe('Activity tracking', () => {
		let sessionService: SessionService

		afterEach(() => {
			sessionService.stopSession()
			sinon.restore()
		})

		function subject(allSpansAreActivity = false) {
			const provider = new SplunkWebTracerProvider()
			const config: SplunkOtelWebConfig = { _experimental_allSpansExtendSession: allSpansAreActivity }
			sessionService = new SessionService(
				config,
				provider,
				storageService,
				new ActivityService(),
				new InternalEventTarget(),
			)
			const firstSessionId = SessionProvider.sessionId
			sessionService.startSession(firstSessionId)
			provider.getTracer('tracer').startSpan('any-span').end()
			sessionService.checkSession()
		}

		it('non-activity spans do not trigger a new session', (done) => {
			const cookieSetSessionDataSpy = sinon.spy(CookieStorage.prototype, 'setSessionData')
			subject()
			assert.equal(cookieSetSessionDataSpy.callCount, 1)
			done()
		})

		it('activity spans do trigger a new session when opt-in', (done) => {
			const cookieSetSessionDataSpy = sinon.spy(CookieStorage.prototype, 'setSessionData')
			subject(true)
			assert.equal(cookieSetSessionDataSpy.callCount, 1)
			done()
		})
	})
})

describe('Session tracking - localStorage', () => {
	const config: SplunkOtelWebConfig = { useLocalStorage: true }
	let storageService: StorageService

	beforeEach(() => {
		storageService = new StorageService(config)
		storageService.clearSessionData()
	})

	afterEach(() => {
		storageService.clearSessionData()
	})

	it('should save session state to local storage', () => {
		const provider = new SplunkWebTracerProvider()
		const sessionService = new SessionService(
			config,
			provider,
			storageService,
			new ActivityService(),
			new InternalEventTarget(),
		)

		const localStorageGetSpy = sinon.spy(LocalStorage.prototype, 'getSessionData')
		const localStorageSetSpy = sinon.spy(LocalStorage.prototype, 'setSessionData')

		sessionService.startSession()
		const firstSessionId = SessionProvider.sessionId
		sessionService.checkSession()
		assert.strictEqual(firstSessionId, SessionProvider.sessionId)
		assert.equal(localStorageGetSpy.callCount, 2)
		assert.equal(localStorageSetSpy.callCount, 2)

		sessionService.stopSession()
		assert.strictEqual(SessionProvider.sessionId, undefined)
	})
})
