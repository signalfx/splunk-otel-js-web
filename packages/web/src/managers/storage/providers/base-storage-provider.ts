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

/**
 * Configuration options for storage operations
 */
export interface StorageOptions {
	/** Domain for cookie storage (only applicable for cookie providers) */
	domain?: string
	/** Expiration in seconds for cookie storage (only applicable for cookie providers) */
	expires: number
}

/**
 * Abstract base class for all storage providers.
 * Provides a common interface for different storage mechanisms (cookies, localStorage, sessionStorage, etc.)
  This class implements the Strategy pattern, allowing the StorageManager to work with
 * different storage backends without knowing their specific implementation details.
 */
export abstract class BaseStorageProvider {
	/**
	 * Gets the name/type of this storage provider for logging and debugging.
	 * Returns a string identifier for this storage provider.
	 */
	abstract providerName: string

	/**
	 * Safely parses JSON data from storage with error handling.
	 * Returns the parsed object, or undefined if parsing fails or key doesn't exist.
	 */
	safelyParseJson<T>(key: string): T | undefined {
		const value = this.getValue(key)
		if (!value) {
			return undefined
		}

		try {
			return JSON.parse(value) as T
		} catch (error) {
			diag.warn(`Failed to parse JSON from ${this.providerName}`, {
				error: error instanceof Error ? error.message : 'Unknown error',
				key,
				value,
			})
			return undefined
		}
	}

	/**
	 * Safely stores an object as JSON in storage with error handling.
	 * Returns true if the operation was successful, false otherwise.
	 */
	safelyStoreJson<T>(key: string, data: T, options: StorageOptions): boolean {
		try {
			const serialized = JSON.stringify(data)
			return this.setValue(key, serialized, options)
		} catch (error) {
			diag.warn(`Failed to serialize and store JSON in ${this.providerName}`, {
				data,
				error: error instanceof Error ? error.message : 'Unknown error',
				key,
			})
			return false
		}
	}

	/**
	 * Retrieves a value from storage by key.
	 * Returns the stored value as a string, or null if not found or inaccessible.
	 */
	abstract getValue(key: string): string | null

	/**
	 * Removes a value from storage by key.
	 * Additional storage options can be provided (e.g., domain for cookies).
	 * Returns true if the operation was successful, false otherwise.
	 */
	abstract removeValue(key: string, options: StorageOptions): boolean

	/**
	 * Stores a value in storage with the given key.
	 * Additional storage options can be provided (e.g., domain, expires for cookies).
	 * Returns true if the operation was successful, false otherwise.
	 */
	abstract setValue(key: string, value: string, options: StorageOptions): boolean
}
