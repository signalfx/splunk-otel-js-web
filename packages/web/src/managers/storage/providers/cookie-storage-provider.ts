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

import { diag } from '@opentelemetry/api'

import { isIframe } from '../../../utils'
import { isSafari } from '../../../utils/is-safari'
import { BaseStorageProvider, StorageOptions } from './base-storage-provider'

export class CookieStorageProvider extends BaseStorageProvider {
	providerName = 'cookie'

	getValue(key: string): string | null {
		try {
			const cookies = document.cookie.split(';')

			for (const cookie of cookies) {
				const [cookieName, cookieValue] = cookie.trim().split('=')
				if (cookieName === key) {
					return decodeURIComponent(cookieValue || '')
				}
			}
		} catch (error) {
			diag.warn('Failed to retrieve cookie', {
				error: error instanceof Error ? error.message : 'Unknown error',
				key,
			})
		}

		return null
	}

	removeValue(key: string, options: StorageOptions) {
		try {
			const expiredDate = 'Thu, 01 Jan 1970 00:00:01 GMT'
			document.cookie = `${key}=;expires=${expiredDate};domain=${options.domain};path=/`
			return true
		} catch (error) {
			diag.warn('Failed to remove cookie', {
				domain: options.domain,
				error,
				key,
			})
			return false
		}
	}

	setValue(key: string, value: string, options: StorageOptions) {
		try {
			const domainPart = options.domain ? `;domain=${options.domain}` : ''
			const encodedValue = encodeURIComponent(value)
			let rawCookie = `${key}=${encodedValue};max-age=${options.expires}${domainPart};path=/`

			if (isIframe()) {
				// Safari does not set cookie when the SameSite attribute is set to None and Secure is set to true in an iframe
				// It fails also in our unit tests since they are running in iframe and on localhost.
				rawCookie +=
					['localhost', '127.0.0.1'].includes(window.location.hostname) && isSafari()
						? ';SameSite=None'
						: ';SameSite=None;Secure'
			} else {
				rawCookie += ';SameSite=Strict'
			}

			document.cookie = rawCookie

			return true
		} catch (error) {
			diag.warn('Failed to set cookie', {
				domain: options.domain,
				error,
				key,
			})
			return false
		}
	}
}
