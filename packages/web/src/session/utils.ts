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
import { SessionState } from './types'
import { SESSION_DURATION_MS, SESSION_ID_LENGTH } from './constants'

export const isSessionState = (maybeSessionState: unknown): maybeSessionState is SessionState =>
	typeof maybeSessionState === 'object' &&
	maybeSessionState !== null &&
	'id' in maybeSessionState &&
	typeof maybeSessionState['id'] === 'string' &&
	maybeSessionState.id.length === SESSION_ID_LENGTH &&
	'startTime' in maybeSessionState &&
	typeof maybeSessionState['startTime'] === 'number'

export const isSessionDurationExceeded = (sessionState: SessionState): boolean => {
	const now = Date.now()
	return sessionState.startTime > now || now > sessionState.startTime + SESSION_DURATION_MS
}

export const isSessionInactivityTimeoutReached = (sessionState: SessionState): boolean => {
	if (sessionState.expiresAt === undefined) {
		return false
	}

	const now = Date.now()
	return now > sessionState.expiresAt
}
