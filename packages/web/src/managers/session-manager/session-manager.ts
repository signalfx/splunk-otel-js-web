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

// Events that extend the session or create a new one
const USER_ACTIVITY_EVENTS = ['click', 'touchstart', 'keydown', 'scroll']

export class SessionManager {
	private isStarted = false

	private session: SessionState | null = null

	private stopCallbacks: Array<() => void> = []

	constructor() {}

	static getNativeSessionId() {
		if (!(typeof window !== 'undefined' && window.SplunkRumNative && window.SplunkRumNative.getNativeSessionId)) {
			return null
		}

		return window.SplunkRumNative.getNativeSessionId()
	}

	getSessionId() {
		return SessionManager.getNativeSessionId() ?? this.session.sessionId
	}

	start() {
		this.isStarted = true

		if (this.isStarted) {
			diag.warn('SessionManager is already started.')
			return
		}

		this.attachUserActivityListeners()
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
		// Implementation for extending or creating new session
	}
}
