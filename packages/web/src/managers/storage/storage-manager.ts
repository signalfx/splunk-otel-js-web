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

import { CookieStorageProvider, LocalStorageProvider, StorageOptions } from './providers'
import { PersistedSessionState, SessionState } from '../session-manager'
import { SESSION_STORAGE_KEY, SESSION_EXPIRATION_COOKIE_SEC } from './constants'
import { diag } from '@opentelemetry/api'

export class StorageManager {
	private readonly cookieStorageProvider = new CookieStorageProvider()

	private readonly localStorageProvider = new LocalStorageProvider()

	private get sessionStorageProvider() {
		switch (this.options.sessionPersistence) {
			case 'cookie':
				return this.cookieStorageProvider
			case 'localStorage':
				return this.localStorageProvider
			default:
				// This should never happen due to TypeScript typing, but provides runtime safety
				throw new Error(`Unknown persistence type: ${this.options.sessionPersistence}`)
		}
	}

	/**
	 * Creates a new StorageManager instance.
	 * The persistence type determines which storage mechanism to use ('cookie' or 'localStorage').
	 * Domain is required for cookie storage.
	 */
	constructor(private readonly options: Omit<StorageOptions, 'expires'>) {}

	clearSessionState() {
		try {
			return this.sessionStorageProvider.removeValue(SESSION_STORAGE_KEY, {
				...this.options,
				expires: SESSION_EXPIRATION_COOKIE_SEC,
			})
		} catch (error) {
			diag.warn('Failed to clear session state', {
				options: this.options,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return false
		}
	}

	getSessionState() {
		try {
			return this.sessionStorageProvider.safelyParseJson<PersistedSessionState>(SESSION_STORAGE_KEY)
		} catch (error) {
			diag.warn('Failed to retrieve session state', {
				options: this.options,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return undefined
		}
	}

	persistSessionState(sessionState: SessionState) {
		const { expiresAt, id, rt, startTime } = sessionState

		diag.debug('SessionManager: Persisting session state', { expiresAt, id, rt, startTime })

		try {
			return this.sessionStorageProvider.safelyStoreJson<PersistedSessionState>(
				SESSION_STORAGE_KEY,
				{ expiresAt, id, rt, startTime },
				{
					...this.options,
					expires: SESSION_EXPIRATION_COOKIE_SEC,
				},
			)
		} catch (error) {
			diag.warn('Failed to persist session state', {
				options: this.options,
				sessionState,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return false
		}
	}
}
