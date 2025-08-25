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

import { SessionState } from './session-state'
import { diag } from '@opentelemetry/api'
import { StorageManager } from '../storage'
import { SESSION_INACTIVITY_TIMEOUT_MS, SESSION_DURATION_MS, SESSION_ID_LENGTH } from './constants'
import { generateId } from '../../utils'
import { Observable } from '../../utils/observable'

// Events that extend the session or create a new one
const USER_ACTIVITY_EVENTS = ['click', 'touchstart', 'keydown', 'scroll']

type SessionStateChange = { currentState: SessionState; previousState: SessionState | null }

export class SessionManager {
	private _session: SessionState

	private isStarted = false

	private get session() {
		return this._session
	}

	private set session(state: SessionState) {
		const previousState = this._session
		this._session = state
		this.storageManager.persistSessionState(this._session)
		this.sessionStateChange.notify({ previousState, currentState: state })
	}

	private readonly sessionStateChange = new Observable<SessionStateChange>()

	private stopCallbacks: Array<() => void> = []

	constructor(private readonly storageManager: StorageManager) {
		const sessionState = this.getSessionStateFromStorageAndValidate()
		if (!sessionState) {
			this._session = SessionManager.generateNewSession('active')
		} else {
			this._session = sessionState
		}
	}

	static getNativeSessionId() {
		if (!(typeof window !== 'undefined' && window.SplunkRumNative && window.SplunkRumNative.getNativeSessionId)) {
			return null
		}

		return window.SplunkRumNative.getNativeSessionId()
	}

	static hasNativeSessionId() {
		return typeof window !== 'undefined' && window.SplunkRumNative && window.SplunkRumNative.getNativeSessionId
	}

	getSessionId() {
		return SessionManager.getNativeSessionId() ?? this.session.sessionId
	}

	markSessionSampled() {
		const previousState = this.session
		this.session = {
			...previousState,
			state: 'sampled',
		}
	}

	start() {
		this.isStarted = true

		if (this.isStarted) {
			diag.warn('SessionManager is already started.')
			return
		}

		this.attachUserActivityListeners()
		this.attachSessionStorageWatch()
	}

	stop() {
		if (!this.isStarted) {
			diag.warn('SessionManager is already stopped.')
			return
		}

		this.isStarted = false
		this.stopCallbacks.forEach((callback) => callback())
		this.stopCallbacks = []
	}

	subscribe(f: (sessionChangeState: SessionStateChange) => void) {
		this.sessionStateChange.subscribe(f)
	}

	private static generateNewSession(state: SessionState['state']): SessionState {
		return {
			expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
			startTime: Date.now(),
			state,
			sessionId: generateId(SESSION_ID_LENGTH * 4),
		}
	}

	private static isSessionExpired(session: SessionState) {
		return Date.now() > session.expiresAt
	}

	private static isSessionMaxDurationReached(session: SessionState) {
		return Date.now() > session.startTime + SESSION_DURATION_MS
	}

	private static isSessionRenewable(session: SessionState) {
		return !SessionManager.isSessionExpired(session) && !SessionManager.isSessionMaxDurationReached(session)
	}

	private addEventListeners(
		target: EventTarget,
		events: readonly string[],
		handler: () => void,
		options: AddEventListenerOptions,
	): { removeListenersCallback: () => void } {
		events.forEach((event) => target.addEventListener(event, handler, options))

		return {
			removeListenersCallback: () =>
				events.forEach((event) => target.removeEventListener(event, handler, options)),
		}
	}

	private attachSessionStorageWatch() {
		const storageChangeCallback = () => {
			// TODO: Do something
		}
		const intervalId = setInterval(storageChangeCallback, 10000)

		this.stopCallbacks.push(() => clearInterval(intervalId))
	}

	private attachUserActivityListeners() {
		// We check for user activity events - click, touchstart, scroll, keydown
		// If the user interacts with the page,
		// we extend the session or create a new one if previous session is expired
		const { removeListenersCallback } = this.addEventListeners(
			window,
			USER_ACTIVITY_EVENTS,
			this.extendOrCreateNewSession,
			{
				capture: true,
				passive: true,
			},
		)

		this.stopCallbacks.push(removeListenersCallback)
	}

	private extendOrCreateNewSession = () => {
		if (SessionManager.hasNativeSessionId()) {
			diag.debug(
				'SessionManager: Native session ID detected. Session extension or creation is managed natively and will not proceed here.',
			)
			return
		}

		// TODO: What should happen if the session is not present
		if (!this.session) {
			diag.warn('SessionManager: Attempted to extend or create a session, but no active session exists.')
			return
		}

		const previousState = this.session
		if (!SessionManager.isSessionRenewable(this.session)) {
			const persistedSessionState = this.storageManager.getSessionState()

			if (persistedSessionState) {
				const sessionState = { ...persistedSessionState, state: 'active' as const }
				if (SessionManager.isSessionRenewable(sessionState)) {
					this.session = sessionState
				} else {
					this.session = SessionManager.generateNewSession('active')
				}
			} else {
				this.session = SessionManager.generateNewSession('active')
			}
		} else {
			this.session = {
				...previousState,
				expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
			}
		}
	}

	private getSessionStateFromStorageAndValidate() {
		const persistedSessionState = this.storageManager.getSessionState()
		if (!persistedSessionState) {
			return null
		}

		const sessionState = { ...persistedSessionState, state: 'active' as const }
		if (SessionManager.isSessionRenewable(sessionState)) {
			return sessionState
		} else {
			return null
		}
	}
}
