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
import { SESSION_STORAGE_KEY } from './constants'
import { isSessionDurationExceeded, isSessionInactivityTimeoutReached, isSessionState } from './utils'
import { CookieStore } from '../storage/cookie-store'

export const cookieStore = new CookieStore<SessionState>(SESSION_STORAGE_KEY, )

// TODO: remove
export function parseCookieToSessionState({ forceDiskRead }: { forceDiskRead: boolean }): SessionState | undefined {
	const sessionState = cookieStore.get({forceDiskRead});

	if (!isSessionState(sessionState)) {
		return undefined
	}

	if (isSessionDurationExceeded(sessionState)) {
		return undefined
	}

	if (isSessionInactivityTimeoutReached(sessionState)) {
		return undefined
	}

	return sessionState
}

// TODO: remove
export function clearSessionCookie(cookieDomain?: string): void {
	cookieStore.remove(cookieDomain)
	cookieStore.flush()
}
