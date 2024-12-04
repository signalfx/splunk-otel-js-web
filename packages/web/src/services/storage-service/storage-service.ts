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
import { SessionData, SplunkOtelWebConfig } from '../../types'
import { Storage } from './storage'
import { LocalStorage } from './local-storage'
import { CookieStorage } from './cookie-storage'

export class StorageService {
	private storage: Storage

	constructor(config: SplunkOtelWebConfig) {
		this.storage = config.useLocalStorage ? new LocalStorage() : new CookieStorage(config)
	}

	getSessionData = (): SessionData | null => this.storage.getSessionData()

	setSessionData = (sessionData: SessionData) => {
		this.storage.setSessionData(sessionData)
	}
}
