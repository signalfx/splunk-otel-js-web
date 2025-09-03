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
import { isTrustedEvent } from '../../utils/is-trusted-event'

// Events that extend the session or create a new one
const USER_ACTIVITY_EVENTS = ['click', 'touchstart', 'keydown', 'scroll']

type SessionStateChange = { currentState: SessionState; previousState: SessionState | null }

export class SessionManager {
	private _session: SessionState

	private isStarted = false

	private lastActivityProcessed = 0

	private get session() {
		return this._session
	}

	private set session(state: SessionState) {
		const previousState = this._session
		this._session = state

		diag.debug('SessionManager: Updating session', { previousState, currentState: state })
		if (state.state === 'active') {
			this.storageManager.persistSessionState(this._session)
		}

		this.sessionStateChange.notify({ previousState, currentState: state })
	}

	private readonly sessionStateChange = new Observable<SessionStateChange>()

	private stopCallbacks: Array<() => void> = []

	constructor(private readonly storageManager: StorageManager) {
		const nativeSessionId = SessionManager.getNativeSessionId()
		if (nativeSessionId) {
			this._session = {
				expiresAt: Date.now() + 4 * SESSION_INACTIVITY_TIMEOUT_MS,
				id: nativeSessionId,
				startTime: Date.now(),
				state: 'native',
			}
		} else {
			const sessionState = this.getSessionStateFromStorageAndValidate()
			if (!sessionState) {
				this._session = SessionManager.generateNewSession('active')
			} else {
				this._session = sessionState
			}

			this.storageManager.persistSessionState(this._session)
		}

		diag.debug('SessionManager: Initialized. Current session state', { state: this._session })
	}

	static getNativeSessionId() {
		if (!(typeof window !== 'undefined' && window.SplunkRumNative && window.SplunkRumNative.getNativeSessionId)) {
			return null
		}

		return window.SplunkRumNative.getNativeSessionId()
	}

	static hasNativeSessionId() {
		return Boolean(
			typeof window !== 'undefined' && window.SplunkRumNative && window.SplunkRumNative.getNativeSessionId,
		)
	}

	getSessionId() {
		return SessionManager.getNativeSessionId() ?? this.session.id
	}

	getSessionState() {
		return this.session
	}

	start() {
		if (this.isStarted) {
			diag.warn('SessionManager is already started.')
			return
		}

		this.isStarted = true
		if (SessionManager.hasNativeSessionId()) {
			this.attachNativeSessionWatch()
		} else {
			this.attachUserActivityListeners()
			this.attachStorageWatch()
			this.attachVisibilityListener()
			this.attachWatchSessionState()
		}
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
		return this.sessionStateChange.subscribe(f)
	}

	private static canContinueUsingSession(session: SessionState) {
		return !SessionManager.isSessionExpired(session) && !SessionManager.isSessionMaxDurationReached(session)
	}

	private static generateNewSession(state: SessionState['state']): SessionState {
		let sessionId = generateId(SESSION_ID_LENGTH * 4)
		if (window['__splunkRumIntegrationTestSessionId']) {
			sessionId = window['__splunkRumIntegrationTestSessionId']
		}

		return {
			expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
			startTime: Date.now(),
			state,
			id: sessionId,
		}
	}

	private static isSessionExpired(session: SessionState) {
		return Date.now() > session.expiresAt
	}

	private static isSessionMaxDurationReached(session: SessionState) {
		return Date.now() > session.startTime + SESSION_DURATION_MS
	}

	private addEventListeners(
		target: EventTarget,
		events: readonly string[],
		handler: (event: Event) => void,
		options: AddEventListenerOptions,
	): { removeListenersCallback: () => void } {
		events.forEach((event) => target.addEventListener(event, handler, options))

		return {
			removeListenersCallback: () =>
				events.forEach((event) => target.removeEventListener(event, handler, options)),
		}
	}

	private attachNativeSessionWatch() {
		const nativeSessionWatch = () => {
			const nativeSessionId = SessionManager.getNativeSessionId()
			const session = this.session

			if (nativeSessionId) {
				this.session = {
					...session,
					id: nativeSessionId,
					expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
					state: 'native',
				}
			}
		}
		const intervalId = setInterval(nativeSessionWatch, 1000)

		this.stopCallbacks.push(() => clearInterval(intervalId))
	}

	private attachStorageWatch() {
		const intervalId = setInterval(this.synchronizeStorageWithCurrentSessionState, 1000)

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

	private attachVisibilityListener() {
		const documentVisibilityCallback = () => {
			if (document.visibilityState === 'visible') {
				diag.debug('SessionManager: Document is in visible state. Synchronizing storage.')
				this.synchronizeStorageWithCurrentSessionState()
			}
		}

		document.addEventListener('visibilitychange', documentVisibilityCallback, {
			capture: true,
			passive: true,
		})

		this.stopCallbacks.push(() => {
			document.removeEventListener('visibilitychange', documentVisibilityCallback)
		})
	}

	private attachWatchSessionState() {
		const intervalId = setInterval(this.watchSessionState, 1000)

		this.stopCallbacks.push(() => clearInterval(intervalId))
	}

	private extendOrCreateNewSession = (event: Event) => {
		const now = performance.now()
		if (this.lastActivityProcessed !== 0 && now - this.lastActivityProcessed < 1000) {
			diag.debug('SessionManager: User activity is throttled.')
			return
		}

		this.lastActivityProcessed = now
		diag.debug(
			'SessionManager: User activity detected - checking if session should be extended or a new one created.',
		)
		if (!isTrustedEvent(event)) {
			diag.debug('SessionManager: extendOrCreateNewSession received untrusted event.')
			return
		}

		if (SessionManager.hasNativeSessionId()) {
			diag.debug('SessionManager: Native session ID detected. Session extension or creation is managed natively.')
			return
		}

		const previousState = this.session

		// The session cannot be used because it has either expired or reached its maximum allowed duration
		if (!SessionManager.canContinueUsingSession(previousState)) {
			diag.debug(
				'SessionManager: Cannot continue current session: session has expired or reached its maximum duration.',
			)

			// Check if another tab has already created a new session. If not, continue using the existing session.
			const persistedSessionState = this.getSessionStateFromStorageAndValidate()
			if (persistedSessionState) {
				this.session = {
					...persistedSessionState,
					state: 'active' as const,
					expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
				}
			} else {
				this.session = SessionManager.generateNewSession('active')
			}
		} else {
			diag.debug('SessionManager: Extending expiration of the current session.', { previousState })
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
		if (SessionManager.canContinueUsingSession(sessionState)) {
			return sessionState
		} else {
			return null
		}
	}

	private synchronizeStorageWithCurrentSessionState = () => {
		// Check if another tab did not start a new session
		const persistedSessionState = this.getSessionStateFromStorageAndValidate()
		if (!persistedSessionState) {
			// There is no session in the persisted storage. Continue using the current one
			return
		}

		// If the session stored in storage is different from the current session,
		// update the SessionManager to use the new session from storage.
		if (persistedSessionState.id !== this.session.id) {
			diag.debug('SessionManager: Session in storage changed.', { persistedSessionState })
			this.session = {
				...persistedSessionState,
				state: 'active',
			}

			return
		}

		if (persistedSessionState.expiresAt > this.session.expiresAt) {
			diag.debug('SessionManager: Expiration of session changed.')
			this.session = {
				...persistedSessionState,
			}

			return
		}
	}

	private watchSessionState = () => {
		if (!SessionManager.canContinueUsingSession(this.session)) {
			const newState = SessionManager.isSessionMaxDurationReached(this.session)
				? 'expired-duration'
				: 'expired-inactivity'

			if (this.session.state !== newState) {
				this.session = {
					...this.session,
					state: newState,
				}
			}
		}
	}
}
