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

import { SpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { InternalEventTarget } from '../EventTarget'
import { generateId } from '../utils'
import { parseCookieToSessionState, renewCookieTimeout } from './cookie-session'
import { SessionState, SessionId } from './types'
import { getSessionStateFromLocalStorage, setSessionStateToLocalStorage } from './local-storage-session'
import { SESSION_INACTIVITY_TIMEOUT_MS } from './constants'
import { suppressTracing } from '@opentelemetry/core'
import { context } from '@opentelemetry/api'

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

let rumSessionId: SessionId | undefined
let recentActivity = false
let cookieDomain: string
let eventTarget: InternalEventTarget | undefined

export function markActivity(): void {
	recentActivity = true
}

function createSessionState(): SessionState {
	return {
		expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
		id: generateId(128),
		startTime: Date.now(),
	}
}

export function getCurrentSessionState({ useLocalStorage = false, forceStoreRead = false }): SessionState | undefined {
	return useLocalStorage
		? getSessionStateFromLocalStorage({ forceStoreRead })
		: parseCookieToSessionState({ forceStoreRead })
}

// This is called periodically and has two purposes:
// 1) Check if the cookie has been expired by the browser; if so, create a new one
// 2) If activity has occurred since the last periodic invocation, renew the cookie timeout
// (Only exported for testing purposes.)
export function updateSessionStatus({
	forceStore,
	useLocalStorage = false,
}: {
	forceStore: boolean
	useLocalStorage: boolean
}): void {
	let sessionState = getCurrentSessionState({ useLocalStorage, forceStoreRead: forceStore })
	let shouldForceWrite = false
	if (!sessionState) {
		// Check if another tab has created a new session
		sessionState = getCurrentSessionState({ useLocalStorage, forceStoreRead: true })
		if (!sessionState) {
			sessionState = createSessionState()
			recentActivity = true // force write of new cookie
			shouldForceWrite = true
		}
	}

	rumSessionId = sessionState.id
	eventTarget?.emit('session-changed', { sessionId: rumSessionId })

	if (recentActivity) {
		sessionState.expiresAt = Date.now() + SESSION_INACTIVITY_TIMEOUT_MS
		if (useLocalStorage) {
			setSessionStateToLocalStorage(sessionState, { forceStoreWrite: shouldForceWrite || forceStore })
		} else {
			renewCookieTimeout(sessionState, cookieDomain, { forceStoreWrite: shouldForceWrite || forceStore })
		}
	}

	recentActivity = false
}

function hasNativeSessionId(): boolean {
	return typeof window !== 'undefined' && window['SplunkRumNative'] && window['SplunkRumNative'].getNativeSessionId
}

class SessionSpanProcessor implements SpanProcessor {
	constructor(
		private readonly options: {
			allSpansAreActivity: boolean
			useLocalStorage: boolean
		},
	) {}

	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	onEnd(): void {}

	onStart(): void {
		if (this.options.allSpansAreActivity) {
			markActivity()
		}

		context.with(suppressTracing(context.active()), () => {
			updateSessionStatus({
				forceStore: false,
				useLocalStorage: this.options.useLocalStorage,
			})
		})
	}

	shutdown(): Promise<void> {
		return Promise.resolve()
	}
}

const ACTIVITY_EVENTS = ['click', 'scroll', 'mousedown', 'keydown', 'touchend', 'visibilitychange']

export function initSessionTracking(
	provider: WebTracerProvider,
	instanceId: SessionId,
	newEventTarget: InternalEventTarget,
	domain?: string,
	allSpansAreActivity = false,
	useLocalStorage = false,
): { deinit: () => void } {
	if (hasNativeSessionId()) {
		// short-circuit and bail out - don't create cookie, watch for inactivity, or anything
		return {
			deinit: () => {
				rumSessionId = undefined
			},
		}
	}

	if (domain) {
		cookieDomain = domain
	}

	rumSessionId = instanceId
	recentActivity = true // document loaded implies activity
	eventTarget = newEventTarget

	ACTIVITY_EVENTS.forEach((type) => document.addEventListener(type, markActivity, { capture: true, passive: true }))
	provider.addSpanProcessor(new SessionSpanProcessor({ allSpansAreActivity, useLocalStorage }))

	updateSessionStatus({ useLocalStorage, forceStore: true })

	return {
		deinit: () => {
			ACTIVITY_EVENTS.forEach((type) => document.removeEventListener(type, markActivity))
			rumSessionId = undefined
			eventTarget = undefined
		},
	}
}

export function getRumSessionId(): SessionId | undefined {
	if (hasNativeSessionId()) {
		return window['SplunkRumNative'].getNativeSessionId()
	}

	return rumSessionId
}
