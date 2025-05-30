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
import { SESSION_INACTIVITY_TIMEOUT_SECONDS } from '../session/constants'
import { isIframe } from '../utils'
import { throttle } from '../utils/throttle'
import { Store } from './store'

const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

export class CookieStore<T> implements Store<T> {
	private cachedValue: T | undefined | null

	private throttledSetRaw = throttle((value: string) => {
		document.cookie = value
	}, 1000)

	constructor(private key: string) {}

	flush() {
		this.throttledSetRaw.flush()
	}

	get({ forceDiskRead = false }: { forceDiskRead?: boolean } = {}) {
		if (this.cachedValue === null || forceDiskRead) {
			const rawValue = this._getRaw(this.key)
			if (rawValue !== undefined) {
				this.cachedValue = this._deserialize(rawValue)
			}
		}

		return this.cachedValue ?? null
	}

	remove(domain?: string) {
		const domainPart = domain ? `domain=${domain};` : ''
		const cookie = `${this.key}=;${domainPart}path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`

		this.throttledSetRaw(cookie)
		this.flush()
	}

	set(value: T, domain?: string) {
		this.cachedValue = value
		this.throttledSetRaw(this._serialize(value, domain))
	}

	protected _deserialize(rawValue: string): T | undefined {
		if (!rawValue) {
			return undefined
		}

		let value: T
		try {
			value = JSON.parse(rawValue) as T // TODO: type T verification?
		} catch {
			return undefined
		}

		return value
	}

	protected _getRaw(cookieName: string): string | undefined {
		const cookies = document.cookie.split(';')
		for (let i = 0; i < cookies.length; i++) {
			const c = cookies[i].trim()
			if (c.indexOf(cookieName + '=') === 0) {
				return decodeURIComponent(c.substring((cookieName + '=').length, c.length))
			}
		}
		return undefined
	}

	protected _serialize(value: T, domain?: string): string {
		const cookieValue = encodeURIComponent(JSON.stringify(value))
		const domainPart = domain ? `domain=${domain};` : ''

		let rawCookie = `${this.key}=${cookieValue};path=/;${domainPart};max-age=${SESSION_INACTIVITY_TIMEOUT_SECONDS}`

		if (isIframe()) {
			// Safari does not set cookie when the SameSite attribute is set to None and Secure is set to true in an iframe
			// It fails also in our unit tests since they are running in iframe and on localhost.
			if (['localhost', '127.0.0.1'].includes(window.location.hostname) && isSafari()) {
				rawCookie += ';SameSite=None'
			} else {
				rawCookie += ';SameSite=None; Secure'
			}
		} else {
			rawCookie += ';SameSite=Strict'
		}

		return rawCookie
	}
}
