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
import { SessionData } from '../../types'
import { SESSION_ID_LENGTH, SESSION_DURATION_SECONDS } from './constants'

export const isSessionData = (maybeSessionData: unknown): maybeSessionData is SessionData =>
	typeof maybeSessionData === 'object' &&
	maybeSessionData !== null &&
	'id' in maybeSessionData &&
	typeof maybeSessionData['id'] === 'string' &&
	maybeSessionData.id.length === SESSION_ID_LENGTH &&
	'startTime' in maybeSessionData &&
	typeof maybeSessionData['startTime'] === 'number'

export const isSessionDurationExceeded = (sessionData: SessionData): boolean => {
	const now = Date.now()
	return sessionData.startTime > now || now > sessionData.startTime + SESSION_DURATION_SECONDS
}

export const isSessionInactivityTimeoutReached = (sessionData: SessionData): boolean => {
	if (!sessionData.expiresAt) {
		return false
	}

	const now = Date.now()
	return now > sessionData.expiresAt
}
