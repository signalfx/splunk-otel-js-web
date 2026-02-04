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

import { PersistenceType } from '../../types'
import { PersistedSessionState, SessionState } from '../session-manager'
import {
	ANONYMOUS_USER_ID_EXPIRATION_SEC,
	ANONYMOUS_USER_ID_STORAGE_KEY,
	SESSION_EXPIRATION_COOKIE_SEC,
	SESSION_STORAGE_KEY,
} from './constants'
import { CookieStorageProvider, LocalStorageProvider, StorageOptions } from './providers'

export class StorageManager {
	private readonly cookieStorageProvider = new CookieStorageProvider()

	private readonly localStorageProvider = new LocalStorageProvider()

	private get storageProvider() {
		switch (this.options.persistence) {
			case 'cookie': {
				return this.cookieStorageProvider
			}
			case 'localStorage': {
				return this.localStorageProvider
			}
			default: {
				// This should never happen due to TypeScript typing, but provides runtime safety
				throw new Error(`Unknown persistence type: ${this.options.persistence}`)
			}
		}
	}

	/**
	 * Creates a new StorageManager instance.
	 * The persistence type determines which storage mechanism to use ('cookie' or 'localStorage').
	 * Domain is required for cookie storage.
	 */
	constructor(private readonly options: Omit<StorageOptions, 'expires'> & { persistence: PersistenceType }) {}

	getAnonymousUserId(): string | undefined {
		try {
			return this.storageProvider.getValue(ANONYMOUS_USER_ID_STORAGE_KEY) || undefined
		} catch (error) {
			diag.warn('Failed to retrieve anonymous user ID', {
				error: error instanceof Error ? error.message : 'Unknown error',
				options: this.options,
			})
			return undefined
		}
	}

	getSessionState() {
		try {
			return this.storageProvider.safelyParseJson<PersistedSessionState>(SESSION_STORAGE_KEY)
		} catch (error) {
			diag.warn('Failed to retrieve session state', {
				error: error instanceof Error ? error.message : 'Unknown error',
				options: this.options,
			})
			return
		}
	}

	persistAnonymousUserId(anonymousUserId: string): boolean {
		diag.debug('StorageManager: Persisting anonymous user ID', { anonymousUserId })

		try {
			return this.storageProvider.setValue(ANONYMOUS_USER_ID_STORAGE_KEY, anonymousUserId, {
				...this.options,
				expires: ANONYMOUS_USER_ID_EXPIRATION_SEC,
			})
		} catch (error) {
			diag.warn('Failed to persist anonymous user ID', {
				anonymousUserId,
				error: error instanceof Error ? error.message : 'Unknown error',
				options: this.options,
			})
			return false
		}
	}

	persistSessionState(sessionState: SessionState) {
		const { expiresAt, id, startTime } = sessionState

		diag.debug('SessionManager: Persisting session state', { expiresAt, id, startTime })

		try {
			return this.storageProvider.safelyStoreJson<PersistedSessionState>(
				SESSION_STORAGE_KEY,
				{ expiresAt, id, startTime },
				{
					...this.options,
					expires: SESSION_EXPIRATION_COOKIE_SEC,
				},
			)
		} catch (error) {
			diag.warn('Failed to persist session state', {
				error: error instanceof Error ? error.message : 'Unknown error',
				options: this.options,
				sessionState,
			})
			return false
		}
	}
}
