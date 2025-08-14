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

export class CookieManager {
	static getCookie(key: string) {
		const cookies = document.cookie.split(';')

		try {
			for (let cookieIndex = 0; cookieIndex < cookies.length; cookieIndex += 1) {
				const cookie = cookies[cookieIndex].trim().split('=')

				if (cookie[0] === key) {
					return cookie[1]
				}
			}
		} catch {
			/// cookie is probably malformed. Ignore it.
		}

		return null
	}

	static removeCookie(key: string, domain: string) {
		try {
			window.document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=${domain};path=/`
		} catch {
			// cookie is unavailable
		}
	}

	static setCookie(key: string, value: string, domain: string, expires: string) {
		try {
			window.document.cookie = `${key}=${value};expires=${expires};domain=${domain};path=/;sameSite=strict;secure`
		} catch {
			// cookie is unavailable
		}
	}
}
