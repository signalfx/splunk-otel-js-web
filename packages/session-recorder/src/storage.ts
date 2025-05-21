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
