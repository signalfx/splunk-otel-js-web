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
import { SessionState } from './types'
import { safelyGetLocalStorage, safelySetLocalStorage, safelyRemoveFromLocalStorage } from '../utils/storage'
import { SESSION_STORAGE_KEY } from './constants'
import { isSessionDurationExceeded, isSessionInactivityTimeoutReached, isSessionState } from './utils'

export const getSessionStateFromLocalStorage = (): SessionState | undefined => {
	let sessionState: unknown = undefined
	try {
		sessionState = JSON.parse(safelyGetLocalStorage(SESSION_STORAGE_KEY))
	} catch {
		return undefined
	}

	if (!isSessionState(sessionState)) {
		return
	}

	if (!isSessionDurationExceeded(sessionState) || isSessionInactivityTimeoutReached(sessionState)) {
		return
	}

	return sessionState
}

export const setSessionStateToLocalStorage = (sessionState: SessionState): void => {
	if (isSessionDurationExceeded(sessionState)) {
		return
	}

	safelySetLocalStorage(SESSION_STORAGE_KEY, JSON.stringify(sessionState))
}

export const clearSessionStateFromLocalStorage = (): void => {
	safelyRemoveFromLocalStorage(SESSION_STORAGE_KEY)
}
