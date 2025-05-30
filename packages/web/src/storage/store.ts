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
import { PersistenceType } from '../types'
import { CookieStore } from './cookie-store'
import { LocalStore } from './local-store'

export interface Store<T> {
	flush: () => void
	get: ({ forceDiskRead }: { forceDiskRead?: boolean }) => T | null
	remove: (domain?: string) => void
	set: (value: T, domain?: string) => void
}

export function buildStore<T>(config: { key: string; type: PersistenceType }): Store<T> {
	if (config.type === 'localStorage') {
		return new LocalStore<T>(config.key)
	}

	if (config.type === 'cookie') {
		return new CookieStore<T>(config.key)
	}

	throw new Error('Unknown store type')
}
