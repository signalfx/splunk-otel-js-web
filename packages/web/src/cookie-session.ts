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
import { isIframe } from './utils'
import { SessionState } from './types'

export const COOKIE_NAME = '_splunk_rum_sid'

const CookieSession = 4 * 60 * 60 * 1000 // 4 hours
const InactivityTimeoutSeconds = 15 * 60

export const cookieStore = {
	set: (value: string): void => {
		document.cookie = value
	},
	get: (): string => document.cookie,
}

export function parseCookieToSessionState(): SessionState | undefined {
	const rawValue = findCookieValue(COOKIE_NAME)
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

	// id validity
	if (
		!sessionState.id ||
		typeof sessionState.id !== 'string' ||
		!sessionState.id.length ||
		sessionState.id.length !== 32
	) {
		return undefined
	}

	// startTime validity
	if (!sessionState.startTime || typeof sessionState.startTime !== 'number' || isPastMaxAge(sessionState.startTime)) {
		return undefined
	}

	return sessionState
}

export function renewCookieTimeout(sessionState: SessionState, cookieDomain: string | undefined): void {
	if (isPastMaxAge(sessionState.startTime)) {
		// safety valve
		return
	}

	const cookieValue = encodeURIComponent(JSON.stringify(sessionState))
	const domain = cookieDomain ? `domain=${cookieDomain};` : ''
	let cookie = COOKIE_NAME + '=' + cookieValue + '; path=/;' + domain + 'max-age=' + InactivityTimeoutSeconds

	if (isIframe()) {
		cookie += ';SameSite=None; Secure'
	} else {
		cookie += ';SameSite=Strict'
	}

	cookieStore.set(cookie)
}

export function clearSessionCookie(cookieDomain?: string): void {
	const domain = cookieDomain ? `domain=${cookieDomain};` : ''
	const cookie = `${COOKIE_NAME}=;domain=${domain};expires=Thu, 01 Jan 1970 00:00:00 GMT`
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

function isPastMaxAge(startTime: number): boolean {
	const now = Date.now()
	return startTime > now || now > startTime + CookieSession
}

function isSessionState(maybeSessionState: unknown): maybeSessionState is SessionState {
	return (
		typeof maybeSessionState === 'object' &&
		maybeSessionState !== null &&
		'id' in maybeSessionState &&
		typeof maybeSessionState['id'] === 'string' &&
		'startTime' in maybeSessionState &&
		typeof maybeSessionState['startTime'] === 'number'
	)
}
