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
import { Storage } from './storage'
import { SessionData, SplunkOtelWebConfig } from '../../types'
import { isSessionData, isSessionDurationExceeded, isSessionInactivityTimeoutReached } from './utils'
import { isIframe } from '../../utils'
import { SESSION_STORAGE_KEY, SESSION_DURATION_SECONDS } from './constants'

export class CookieStorage extends Storage {
	constructor(private readonly config: SplunkOtelWebConfig) {
		super()
	}

	clear() {
		this.remove(SESSION_STORAGE_KEY)
	}

	getSessionData(): SessionData | null {
		const sessionData = this.getCookieSessionData()
		if (!isSessionData(sessionData)) {
			return null
		}

		if (isSessionDurationExceeded(sessionData)) {
			return null
		}

		if (isSessionInactivityTimeoutReached(sessionData)) {
			return null
		}

		return sessionData
	}

	setSessionData(sessionData: SessionData) {
		if (isSessionDurationExceeded(sessionData)) {
			return
		}

		this.set(SESSION_STORAGE_KEY, encodeURIComponent(JSON.stringify(sessionData)))
	}

	protected get(key: string): string | null {
		const decodedCookie = decodeURIComponent(window.document.cookie)
		const cookies = decodedCookie.split(';')

		try {
			for (let cookieIndex = 0; cookieIndex < cookies.length; cookieIndex += 1) {
				const cookie = cookies[cookieIndex].trim().split('=')
				if (cookie[0] === key) {
					return cookie[1]
				}
			}
		} catch {
			// Cookie is probably malformed. Ignore it.
		}

		return null
	}

	protected remove(key: string): void {
		const domain = this.config.cookieDomain ? `domain=${this.config.cookieDomain};` : ''
		window.document.cookie = `${key}=;${domain}expires=Thu, 01 Jan 1970 00:00:01 GMT`
	}

	protected set(key: string, value: string): void {
		if (!value) {
			return
		}

		const domain = this.config.cookieDomain ? `domain=${this.config.cookieDomain};` : ''
		const sameSite = isIframe() ? 'SameSite=None; Secure' : 'SameSite=Strict'
		window.document.cookie = `${key}=${value};${domain}path=/;max-age=${SESSION_DURATION_SECONDS};${sameSite}`
	}

	private getCookieSessionData = (): Record<string, unknown> => {
		const cookie = this.get(SESSION_STORAGE_KEY)
		if (!cookie) {
			return {}
		}

		const decodedCookieValue = decodeURIComponent(cookie)
		if (!decodedCookieValue) {
			return {}
		}

		try {
			return JSON.parse(decodedCookieValue ?? '{}')
		} catch {
			return {}
		}
	}
}
