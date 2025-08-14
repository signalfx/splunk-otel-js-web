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

import { BaseStorageProvider, StorageOptions } from './base-storage-provider'
import { diag } from '@opentelemetry/api'

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
				key,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}

		return null
	}

	removeValue(key: string, options?: StorageOptions) {
		if (!options?.domain) {
			diag.warn('Domain is required for cookie removal')
			return false
		}

		try {
			const expiredDate = 'Thu, 01 Jan 1970 00:00:01 GMT'
			document.cookie = `${key}=;expires=${expiredDate};domain=${options.domain};path=/`
			return true
		} catch (error) {
			diag.warn('Failed to remove cookie', {
				key,
				domain: options.domain,
				error,
			})
			return false
		}
	}

	setValue(key: string, value: string, options?: StorageOptions) {
		if (!options?.domain) {
			diag.warn('Domain is required for cookie storage')
			return false
		}

		if (!options?.expires) {
			diag.warn('Expires is required for cookie storage')
			return false
		}

		try {
			const encodedValue = encodeURIComponent(value)
			document.cookie = `${key}=${encodedValue};expires=${options.expires};domain=${options.domain};path=/;sameSite=strict;secure`

			return true
		} catch (error) {
			diag.warn('Failed to set cookie', {
				key,
				domain: options.domain,
				error,
			})
			return false
		}
	}
}
