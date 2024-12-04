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
import { safelyGetLocalStorage, safelySetLocalStorage, safelyRemoveFromLocalStorage } from './utils/storage'

const SESSION_ID_LENGTH = 32
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000 // 4 hours

const SESSION_ID_KEY = '_SPLUNK_SESSION_ID'
const SESSION_LAST_UPDATED_KEY = '_SPLUNK_SESSION_LAST_UPDATED'

export const getSessionStateFromLocalStorage = (): SessionState | undefined => {
	const sessionId = safelyGetLocalStorage(SESSION_ID_KEY)
	if (!isSessionIdValid(sessionId)) {
		return
	}

	const startTimeString = safelyGetLocalStorage(SESSION_LAST_UPDATED_KEY)
	const startTime = Number.parseInt(startTimeString, 10)
	if (!isSessionStartTimeValid(startTime) || isSessionExpired(startTime)) {
		return
	}

	return { id: sessionId, startTime }
}

export const setSessionStateToLocalStorage = (sessionState: SessionState): void => {
	if (isSessionExpired(sessionState.startTime)) {
		return
	}

	safelySetLocalStorage(SESSION_ID_KEY, sessionState.id)
	safelySetLocalStorage(SESSION_LAST_UPDATED_KEY, String(sessionState.startTime))
}

export const clearSessionStateFromLocalStorage = (): void => {
	safelyRemoveFromLocalStorage(SESSION_ID_KEY)
	safelyRemoveFromLocalStorage(SESSION_LAST_UPDATED_KEY)
}

const isSessionIdValid = (sessionId: unknown): boolean =>
	typeof sessionId === 'string' && sessionId.length === SESSION_ID_LENGTH

const isSessionStartTimeValid = (startTime: unknown): boolean =>
	typeof startTime === 'number' && startTime <= Date.now()

const isSessionExpired = (startTime: number) => Date.now() - startTime > SESSION_DURATION_MS
