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

import { CookieManager } from './cookie-manager'
import { LocalStorageManager } from './local-storage-manager'
import { Persistence } from './persistence'
import { SessionState } from '../session-manager'
import { SESSION_STORAGE_KEY, SESSION_EXPIRATION_COOKIE_MS } from './constants'
import { diag } from '@opentelemetry/api'

export class StorageManager {
	constructor(
		private readonly persistence: Persistence,
		private readonly domain: string,
	) {}

	getSessionState(): SessionState | undefined {
		let sessionStateStringified
		if (this.persistence === 'cookie') {
			sessionStateStringified = CookieManager.getCookie(SESSION_STORAGE_KEY)
		} else if (this.persistence === 'localStorage') {
			sessionStateStringified = LocalStorageManager.getItem(SESSION_STORAGE_KEY)
		} else {
			throw new Error(`Unknown persistence type: ${this.persistence}`)
		}

		try {
			return sessionStateStringified ? (JSON.parse(sessionStateStringified) as SessionState) : undefined
		} catch {
			diag.warn('Failed to parse session state', { sessionStateStringified, persistence: this.persistence })
			return
		}
	}

	persistSessionState(sessionState: SessionState): void {
		const sessionStateStringified = JSON.stringify(sessionState)
		if (this.persistence === 'cookie') {
			CookieManager.setCookie(
				SESSION_STORAGE_KEY,
				sessionStateStringified,
				this.domain,
				new Date(Date.now() + SESSION_EXPIRATION_COOKIE_MS).toUTCString(),
			)
		} else if (this.persistence === 'localStorage') {
			LocalStorageManager.setItem(SESSION_STORAGE_KEY, sessionStateStringified)
		} else {
			throw new Error(`Unknown persistence type: ${this.persistence}`)
		}
	}
}
