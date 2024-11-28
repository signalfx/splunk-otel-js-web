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
import { isIframe } from '../utils'
import { SessionState } from './types'
import { SESSION_DURATION_SECONDS, SESSION_STORAGE_KEY } from './constants'
import { isSessionDurationExceeded, isSessionInactivityTimeoutReached, isSessionState } from './utils'

export const cookieStore = {
	set: (value: string): void => {
		document.cookie = value
	},
	get: (): string => document.cookie,
}

export function parseCookieToSessionState(): SessionState | undefined {
	const rawValue = findCookieValue(SESSION_STORAGE_KEY)
	if (!rawValue) {
		return undefined
	}

	const decoded = decodeURIComponent(rawValue)
	if (!decoded) {
		return undefined
	}

	let sessionState: unknown = undefined
	try {
		sessionState = JSON.parse(decoded)
	} catch {
		return undefined
	}

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

export function renewCookieTimeout(sessionState: SessionState, cookieDomain: string | undefined): void {
	if (isSessionDurationExceeded(sessionState)) {
		// safety valve
		return
	}

	const cookieValue = encodeURIComponent(JSON.stringify(sessionState))
	const domain = cookieDomain ? `domain=${cookieDomain};` : ''
	let cookie = SESSION_STORAGE_KEY + '=' + cookieValue + '; path=/;' + domain + 'max-age=' + SESSION_DURATION_SECONDS

	if (isIframe()) {
		cookie += ';SameSite=None; Secure'
	} else {
		cookie += ';SameSite=Strict'
	}

	cookieStore.set(cookie)
}

export function clearSessionCookie(cookieDomain?: string): void {
	const domain = cookieDomain ? `domain=${cookieDomain};` : ''
	const cookie = `${SESSION_STORAGE_KEY}=;domain=${domain};expires=Thu, 01 Jan 1970 00:00:00 GMT`
	cookieStore.set(cookie)
}

export function findCookieValue(cookieName: string): string | undefined {
	const decodedCookie = decodeURIComponent(cookieStore.get())
	const cookies = decodedCookie.split(';')
	for (let i = 0; i < cookies.length; i++) {
		const c = cookies[i].trim()
		if (c.indexOf(cookieName + '=') === 0) {
			return c.substring((cookieName + '=').length, c.length)
		}
	}
	return undefined
}
