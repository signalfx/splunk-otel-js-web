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

import { InternalEventTarget } from '../EventTarget'
import { generateId } from '../utils'
import { SessionState, SessionId, RecorderType } from './types'
import { SESSION_INACTIVITY_TIMEOUT_MS, SESSION_STORAGE_KEY } from './constants'
import { isSessionDurationExceeded, isSessionInactivityTimeoutReached, isSessionState } from './utils'
import { PersistenceType } from '../types'
import { buildStore, Store } from '../storage/store'
import { getGlobal } from '../global-utils'

/*
    The basic idea is to let the browser expire cookies for us "naturally" once
    IntactivityTimeout is reached.  Activity (including any page load)
    extends the session.  The true startTime of the session is set in the cookie value
    and if an extension would ever exceed MaxAge it doesn't happen.
    We use a background periodic timer to check for expired cookies and initialize new ones.
    Session state is stored in the cookie as uriencoded json and is of the form
    {
        id: 'sessionIdAsHex',
        startTime: startTimeAsNewDate_getTime
    }
    Future work can add more fields though note that the fact that the value doesn't change
    once created makes this very robust when used in multiple tabs/windows - tabs don't compete/
    race to do anything but set the max-age.

    Finally, if SplunkRumNative exists, use its session ID exclusively and don't bother
    with setting cookies, checking for inactivity, etc.
*/

let recentActivity = false
let cookieDomain: string | undefined
let eventTarget: InternalEventTarget | undefined
let isNewSessionId = false

export function markActivity(): void {
	recentActivity = true
}

function generateSessionId(id?: string): string {
	if (window['__splunkRumIntegrationTestSessionId']) {
		return window['__splunkRumIntegrationTestSessionId']
	}

	if (id) {
		return id
	}

	return generateId(128)
}

function createSessionState(id?: string): SessionState {
	return {
		expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
		id: generateSessionId(id),
		startTime: Date.now(),
	}
}

let store: Store<SessionState> | null = null

export function getNullableStore() {
	return store
}

function getStore(): Store<SessionState> {
	const str = getNullableStore()

	if (str) {
		return str
	}

	throw new Error('Session store was accessed but not initialized.')
}

export function getOrInitInactiveSession(): SessionState {
	let sessionState = getCurrentSessionState({ forceDiskRead: false })

	if (!sessionState) {
		sessionState = updateSessionStatus({ forceStore: true, inactive: true })
	}

	return sessionState
}

export function getCurrentSessionState({ forceDiskRead = false }): SessionState | undefined {
	const sessionState = getStore().get({ forceDiskRead })

	if (!isSessionState(sessionState)) {
		return undefined
	}

	if (isSessionDurationExceeded(sessionState) || isSessionInactivityTimeoutReached(sessionState)) {
		return undefined
	}

	return sessionState
}

// This is called periodically and has two purposes:
// 1) Check if the cookie has been expired by the browser; if so, create a new one
// 2) If activity has occurred since the last periodic invocation, renew the cookie timeout
// (Only exported for testing purposes.)
export function updateSessionStatus({
	forceNewSession = false,
	forceStore,
	hadActivity,
	inactive = undefined,
	recorderType = undefined,
}: {
	forceNewSession?: boolean
	forceStore: boolean
	hadActivity?: boolean
	inactive?: boolean
	recorderType?: RecorderType
}): SessionState {
	let sessionState = getCurrentSessionState({ forceDiskRead: forceStore })
	let shouldForceWrite = false
	if (!sessionState || forceNewSession) {
		// Check if another tab has created a new session
		sessionState = getCurrentSessionState({ forceDiskRead: true })
		if (!sessionState || forceNewSession) {
			sessionState = createSessionState()
			recentActivity = true // force write of new cookie
			shouldForceWrite = true
			isNewSessionId = true
		}
	}

	if (sessionState.inactive !== inactive) {
		sessionState.inactive = inactive
		shouldForceWrite = true
	}

	if (recorderType && sessionState.rt !== recorderType) {
		sessionState.rt = recorderType
		shouldForceWrite = true
	}

	eventTarget?.emit('session-changed', { sessionId: sessionState.id })

	if (recentActivity || hadActivity) {
		sessionState.expiresAt = Date.now() + SESSION_INACTIVITY_TIMEOUT_MS

		// TODO: review if this check makes sense
		if (!isSessionDurationExceeded(sessionState)) {
			store?.set(sessionState, cookieDomain)
			if (shouldForceWrite) {
				store?.flush()
			}
		}
	}

	recentActivity = false
	return sessionState
}

function hasNativeSessionId(): boolean {
	return Boolean(typeof window !== 'undefined' && window.SplunkRumNative && window.SplunkRumNative.getNativeSessionId)
}

const ACTIVITY_EVENTS = ['click', 'scroll', 'mousedown', 'keydown', 'touchend', 'visibilitychange']

export type SessionTrackingHandle = {
	clearSession: () => void
	deinit: () => void
	flush: () => void
}

export function initSessionTracking(
	persistence: NonNullable<PersistenceType>,
	newEventTarget: InternalEventTarget,
	domain?: string,
): SessionTrackingHandle {
	if (hasNativeSessionId() && window.SplunkRumNative) {
		// short-circuit and bail out - don't create cookie, watch for inactivity, or anything

		const sessionId = window.SplunkRumNative.getNativeSessionId()
		const sessionState = createSessionState(sessionId)

		store = {
			get: () => sessionState,
			flush: () => {},
			set: () => {
				throw new Error('Cannot override native RUM session ID.')
			},
			remove: () => {
				throw new Error('Cannot clear native RUM session ID.')
			},
		}

		return {
			deinit: () => {},
			clearSession: () => {},
			flush: () => {},
		}
	}

	store = buildStore({
		type: persistence,
		key: SESSION_STORAGE_KEY,
	})

	if (domain) {
		cookieDomain = domain
	}

	recentActivity = true // document loaded implies activity
	eventTarget = newEventTarget

	ACTIVITY_EVENTS.forEach((type) => document.addEventListener(type, markActivity, { capture: true, passive: true }))

	updateSessionStatus({ forceStore: true })

	// TODO: For integration tests, find better solution
	const SplunkRum = getGlobal() as Record<string, unknown>
	if (SplunkRum) {
		SplunkRum['store'] = store
	}

	return {
		deinit: () => {
			ACTIVITY_EVENTS.forEach((type) => document.removeEventListener(type, markActivity))
			eventTarget = undefined
		},
		clearSession: () => {
			store?.remove()
			store?.flush()
		},
		flush: () => {
			store?.flush()
		},
	}
}

export function getRumSessionId(): SessionId | undefined {
	if (hasNativeSessionId() && window.SplunkRumNative) {
		return window.SplunkRumNative.getNativeSessionId()
	}

	const sessionState = getCurrentSessionState({ forceDiskRead: true })
	if (!sessionState || sessionState.inactive) {
		return undefined
	}

	return sessionState.id
}

export function getIsNewSession(): boolean {
	return isNewSessionId
}

export function checkSessionRecorderType(recorderType: RecorderType): void {
	const sessionState = getCurrentSessionState({ forceDiskRead: true })
	if (sessionState && sessionState.rt !== recorderType) {
		updateSessionStatus({ forceStore: true, forceNewSession: true, recorderType })
		console.debug('Session recorder type changed, creating new session', { recorderType })
	}
}
