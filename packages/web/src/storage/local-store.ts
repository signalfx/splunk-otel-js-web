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

import { throttle } from '../utils/throttle'
import { Store } from './store'

export class LocalStore<T> implements Store<T> {
	private cachedValue: T | null | undefined

	private throttledSetRaw = throttle((value: string) => {
		safelySetLocalStorage(this.key, value)
	}, 1000)

	constructor(private key: string) {}

	flush() {
		this.throttledSetRaw.flush()
	}

	get({ forceDiskRead = false }: { forceDiskRead?: boolean } = {}) {
		if (this.cachedValue === undefined || forceDiskRead) {
			const value = safelyGetLocalStorage(this.key)
			this.cachedValue = value && JSON.parse(value)
		}

		return this.cachedValue ?? null
	}

	remove() {
		safelyRemoveFromLocalStorage(this.key)
		this.cachedValue = undefined

		this.flush()
	}

	set(value: T) {
		this.cachedValue = value
		this.throttledSetRaw(JSON.stringify(value))
	}
}

export const safelyGetLocalStorage = (key: string): string | null => {
	let value = null
	try {
		value = window.localStorage.getItem(key)
	} catch {
		// localStorage not accessible probably user is in incognito-mode
		// or set "Block third-party cookies" option in browser settings
	}
	return value
}

export const safelySetLocalStorage = (key: string, value: string): boolean => {
	try {
		window.localStorage.setItem(key, value)
		return true
	} catch {
		// localStorage not accessible probably user is in incognito-mode
		// or set "Block third-party cookies" option in browser settings
		return false
	}
}

export const safelyRemoveFromLocalStorage = (key: string): void => {
	try {
		window.localStorage.removeItem(key)
	} catch {
		// localStorage not accessible probably user is in incognito-mode
		// or set "Block third-party cookies" option in browser settings
	}
}

export const safelyGetSessionStorage = (key: string): string | null | undefined => {
	try {
		return window.sessionStorage.getItem(key)
	} catch {
		return undefined
		// sessionStorage not accessible probably user is in incognito-mode
		// or set "Block third-party cookies" option in browser settings
	}
}

export const safelySetSessionStorage = (key: string, value: string): boolean => {
	try {
		window.sessionStorage.setItem(key, value)
		return true
	} catch {
		// sessionStorage not accessible probably user is in incognito-mode
		// or set "Block third-party cookies" option in browser settings
		return false
	}
}
