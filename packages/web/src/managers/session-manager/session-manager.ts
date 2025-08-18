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
import { SESSION_INACTIVITY_TIMEOUT_MS, SESSION_DURATION_MS } from './constants'
import { generateId } from '../../utils'

// Events that extend the session or create a new one
const USER_ACTIVITY_EVENTS = ['click', 'touchstart', 'keydown', 'scroll']

export class SessionManager {
	private isStarted = false

	private session: SessionState | null = null

	private stopCallbacks: Array<() => void> = []

	constructor(private readonly storageManager: StorageManager) {}

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
		return SessionManager.getNativeSessionId() ?? this.session?.sessionId
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

	private static generateNewSession(): SessionState {
		return {
			expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
			startTime: Date.now(),
			state: 'active',
			sessionId: generateId(128),
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
		const storageChangeCallback = () => {}
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
			return
		}

		// TODO: What should happen if the session is not present
		if (!this.session) {
			return
		}

		if (!SessionManager.isSessionRenewable(this.session)) {
			const sessionStateInStorage = this.storageManager.getSessionState()
			if (sessionStateInStorage) {
				if (SessionManager.isSessionRenewable(sessionStateInStorage)) {
					this.session = sessionStateInStorage
				} else {
					// TODO: Notify about new session generated
					this.session = SessionManager.generateNewSession()
				}
			} else {
				// TODO: Notify about new session generated
				this.session = SessionManager.generateNewSession()
			}
		} else {
			this.session.expiresAt = Date.now() + SESSION_INACTIVITY_TIMEOUT_MS
		}

		this.storageManager.persistSessionState(this.session)
	}
}
