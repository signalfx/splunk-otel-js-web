/**
 *
 * Copyright 2020-2026 Splunk Inc.
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

import { BaseStorageProvider } from './base-storage-provider'

export class SessionStorageProvider extends BaseStorageProvider {
	providerName = 'sessionStorage'

	static safelyGetValue(key: string): string | null {
		try {
			return window.sessionStorage.getItem(key)
		} catch (error) {
			diag.warn('Failed to retrieve item from sessionStorage', {
				error,
				key,
			})
			return null
		}
	}

	static safelyRemoveValue(key: string) {
		try {
			window.sessionStorage.removeItem(key)

			return true
		} catch (error) {
			diag.warn('Failed to remove item from localStorage', {
				error: error instanceof Error ? error.message : 'Unknown error',
				key,
			})
			return false
		}
	}

	static safelySetValue(key: string, value: string) {
		try {
			window.sessionStorage.setItem(key, value)
			return true
		} catch (error) {
			diag.warn('Failed to store item in localStorage', {
				error,
				key,
			})
			return false
		}
	}

	getValue(...args: Parameters<(typeof SessionStorageProvider)['safelyGetValue']>) {
		return SessionStorageProvider.safelyGetValue(...args)
	}

	removeValue(...args: Parameters<(typeof SessionStorageProvider)['safelyRemoveValue']>) {
		return SessionStorageProvider.safelyRemoveValue(...args)
	}

	setValue(...args: Parameters<(typeof SessionStorageProvider)['safelySetValue']>) {
		return SessionStorageProvider.safelySetValue(...args)
	}
}
