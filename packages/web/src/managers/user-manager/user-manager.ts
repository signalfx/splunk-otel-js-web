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

import { UserTrackingMode } from '../../types'
import { generateId } from '../../utils'
import { StorageManager } from '../storage'
import { ANONYMOUS_USER_ID_LENGTH } from './constants'

/**
 * Manages anonymous user identification across sessions.
 * Generates and persists a unique anonymous user ID using the configured storage mechanism.
 */
export class UserManager {
	private anonymousId: string | undefined

	constructor(
		public userTrackingMode: UserTrackingMode,
		private readonly storageManager: StorageManager,
	) {}

	static isUserTrackingMode = (value: unknown): value is UserTrackingMode =>
		value === 'noTracking' || value === 'anonymousTracking'

	forgetAnonymousId(): void {
		this.anonymousId = undefined
	}

	getAnonymousIdIfEnabled(): string | undefined {
		if (this.userTrackingMode !== 'anonymousTracking') {
			return undefined
		}

		if (this.anonymousId) {
			return this.anonymousId
		}

		const storedId = this.getAnonymousIdFromStorage()
		if (storedId) {
			this.anonymousId = storedId
			// extend the expiration
			this.persistAnonymousId(storedId)
			return storedId
		}

		const newId = UserManager.generateAnonymousId()
		this.persistAnonymousId(newId)
		this.anonymousId = newId

		return newId
	}

	private static generateAnonymousId(): string {
		return generateId(ANONYMOUS_USER_ID_LENGTH)
	}

	private getAnonymousIdFromStorage(): string | undefined {
		try {
			return this.storageManager.getAnonymousUserId()
		} catch (error) {
			diag.warn('Failed to retrieve anonymous user ID from storage', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return undefined
		}
	}

	private persistAnonymousId(id: string): boolean {
		try {
			return this.storageManager.persistAnonymousUserId(id)
		} catch (error) {
			diag.warn('Failed to persist anonymous user ID', {
				error: error instanceof Error ? error.message : 'Unknown error',
				id,
			})
			return false
		}
	}
}
