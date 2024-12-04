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
import { safelyGetLocalStorage, safelyRemoveFromLocalStorage, safelySetLocalStorage } from '../../utils/storage'
import { isSessionDurationExceeded, isSessionData, isSessionInactivityTimeoutReached } from './utils'
import { SessionData } from '../../types'
import { SESSION_STORAGE_KEY } from './constants'

export class LocalStorage extends Storage {
	clear(): void {
		this.remove(SESSION_STORAGE_KEY)
	}

	getSessionData(): SessionData | null {
		const sessionData = this.getLocalStorageSessionData()
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

	setSessionData(sessionData: SessionData): void {
		if (isSessionDurationExceeded(sessionData)) {
			return
		}

		this.set(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
	}

	protected get(key: string): string | null {
		return safelyGetLocalStorage(key)
	}

	protected remove(key: string): void {
		safelyRemoveFromLocalStorage(key)
	}

	protected set(key: string, value: string): void {
		safelySetLocalStorage(key, value)
	}

	private getLocalStorageSessionData = (): Record<string, unknown> => {
		const localStorageData = this.get(SESSION_STORAGE_KEY)

		try {
			return JSON.parse(localStorageData ?? '{}')
		} catch {
			return {}
		}
	}
}
