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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_EXPIRATION_COOKIE_SEC } from '../constants'
import { SessionPersistence } from './base-storage-provider'
import { LocalStorageProvider } from './local-storage-provider'

const validOptions = {
	expires: SESSION_EXPIRATION_COOKIE_SEC, // 3 months
	sessionPersistence: 'localStorage' as SessionPersistence,
}

describe('LocalStorageProvider', () => {
	let provider: LocalStorageProvider

	beforeEach(() => {
		provider = new LocalStorageProvider()
	})

	afterEach(() => {
		// Clear localStorage completely
		localStorage.clear()
	})

	describe('providerName', () => {
		it('should return "localStorage" as provider name', () => {
			expect(provider.providerName).toBe('localStorage')
		})
	})

	describe('getValue', () => {
		it('should return null when no items exist', () => {
			const result = provider.getValue('testKey')
			expect(result).toBeNull()
		})

		it('should return null when key does not exist', () => {
			localStorage.setItem('otherKey', 'otherValue')
			const result = provider.getValue('testKey')
			expect(result).toBeNull()
		})

		it('should return the correct value for existing key', () => {
			localStorage.setItem('testKey', 'testValue')
			const result = provider.getValue('testKey')
			expect(result).toBe('testValue')
		})

		it('should return the correct value when multiple items exist', () => {
			localStorage.setItem('key1', 'value1')
			localStorage.setItem('testKey', 'testValue')
			localStorage.setItem('key2', 'value2')

			const result = provider.getValue('testKey')
			expect(result).toBe('testValue')
			expect(localStorage.getItem('key1')).toBe('value1')
			expect(localStorage.getItem('testKey')).toBe('testValue')
			expect(localStorage.getItem('key2')).toBe('value2')
		})

		it('should handle values with spaces', () => {
			const valueWithSpaces = 'test value with spaces'
			localStorage.setItem('testKey', valueWithSpaces)
			const result = provider.getValue('testKey')
			expect(result).toBe('test value with spaces')
		})

		it('should handle empty values', () => {
			localStorage.setItem('testKey', '')
			const result = provider.getValue('testKey')
			expect(result).toBe('')
		})

		it('should handle special characters in values', () => {
			const specialValue = '{"test": "value", "number": 123}'
			localStorage.setItem('testKey', specialValue)
			const result = provider.getValue('testKey')
			expect(result).toBe('{"test": "value", "number": 123}')
		})

		it('should return null when localStorage access fails', () => {
			const originalGetItem = localStorage.getItem
			vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
				throw new Error('localStorage access denied')
			})

			const result = provider.getValue('testKey')
			expect(result).toBeNull()

			// Restore original method
			localStorage.getItem = originalGetItem
		})
	})

	describe('setValue', () => {
		it('should successfully set a value', () => {
			const result = provider.setValue('testKey', 'testValue')

			expect(result).toBe(true)
			expect(localStorage.getItem('testKey')).toBe('testValue')
		})

		it('should handle values with spaces', () => {
			const valueWithSpaces = 'test value with spaces'
			const result = provider.setValue('testKey', valueWithSpaces)

			expect(result).toBe(true)
			expect(localStorage.getItem('testKey')).toBe(valueWithSpaces)
		})

		it('should handle special characters in values', () => {
			const specialValue = '{"test": "value", "number": 123}'
			const result = provider.setValue('testKey', specialValue)

			expect(result).toBe(true)
			expect(localStorage.getItem('testKey')).toBe(specialValue)
		})

		it('should handle empty string values', () => {
			const result = provider.setValue('testKey', '')

			expect(result).toBe(true)
			expect(localStorage.getItem('testKey')).toBe('')
		})

		it('should overwrite existing values', () => {
			localStorage.setItem('testKey', 'oldValue')
			const result = provider.setValue('testKey', 'newValue')

			expect(result).toBe(true)
			expect(localStorage.getItem('testKey')).toBe('newValue')
		})
	})

	describe('removeValue', () => {
		it('should successfully remove an existing item', () => {
			localStorage.setItem('testKey', 'testValue')
			const result = provider.removeValue('testKey')

			expect(result).toBe(true)
			expect(localStorage.getItem('testKey')).toBeNull()
		})

		it('should return true even when removing non-existent key', () => {
			const result = provider.removeValue('nonExistentKey')

			expect(result).toBe(true)
			expect(localStorage.getItem('nonExistentKey')).toBeNull()
		})
	})
	describe('safelyParseJson', () => {
		it('should return undefined when key does not exist', () => {
			const result = provider.safelyParseJson('nonExistentKey')
			expect(result).toBeUndefined()
		})

		it('should return undefined when value is empty', () => {
			localStorage.setItem('testKey', '')
			const result = provider.safelyParseJson('testKey')
			expect(result).toBeUndefined()
		})

		it('should successfully parse valid JSON', () => {
			const testData = { name: 'test', value: 123 }
			const jsonString = JSON.stringify(testData)
			localStorage.setItem('testKey', jsonString)

			const result = provider.safelyParseJson<typeof testData>('testKey')
			expect(result).toEqual(testData)
		})

		it('should return undefined for invalid JSON', () => {
			localStorage.setItem('testKey', 'invalid-json')

			const result = provider.safelyParseJson('testKey')
			expect(result).toBeUndefined()
		})

		it('should handle complex nested objects', () => {
			const complexData = {
				sessions: ['session1', 'session2'],
				user: {
					id: 123,
					name: 'John Doe',
					preferences: {
						notifications: true,
						theme: 'dark',
					},
				},
			}
			const jsonString = JSON.stringify(complexData)
			localStorage.setItem('testKey', jsonString)

			const result = provider.safelyParseJson<typeof complexData>('testKey')
			expect(result).toEqual(complexData)
		})

		it('should handle arrays', () => {
			const arrayData = [1, 2, 3, 'test', { nested: true }]
			const jsonString = JSON.stringify(arrayData)
			localStorage.setItem('testKey', jsonString)

			const result = provider.safelyParseJson<typeof arrayData>('testKey')
			expect(result).toEqual(arrayData)
		})

		it('should handle null values', () => {
			localStorage.setItem('testKey', 'null')

			const result = provider.safelyParseJson('testKey')
			expect(result).toBeNull()
		})
	})

	describe('safelyStoreJson', () => {
		it('should successfully store JSON data', () => {
			const testData = { name: 'test', value: 123 }
			const result = provider.safelyStoreJson('testKey', testData, validOptions)

			expect(result).toBe(true)
			const expectedJson = JSON.stringify(testData)
			expect(localStorage.getItem('testKey')).toBe(expectedJson)
		})

		it('should handle complex nested objects', () => {
			const complexData = {
				sessions: ['session1', 'session2'],
				user: {
					id: 123,
					name: 'John Doe',
					preferences: {
						notifications: true,
						theme: 'dark',
					},
				},
			}
			const result = provider.safelyStoreJson('testKey', complexData, validOptions)

			expect(result).toBe(true)
			const expectedJson = JSON.stringify(complexData)
			expect(localStorage.getItem('testKey')).toBe(expectedJson)
		})

		it('should handle arrays', () => {
			const arrayData = [1, 2, 3, 'test', { nested: true }]
			const result = provider.safelyStoreJson('testKey', arrayData, validOptions)

			expect(result).toBe(true)
			const expectedJson = JSON.stringify(arrayData)
			expect(localStorage.getItem('testKey')).toBe(expectedJson)
		})

		it('should handle null and undefined values', () => {
			const result1 = provider.safelyStoreJson('testKey1', null, validOptions)
			const result2 = provider.safelyStoreJson('testKey2', undefined, validOptions)

			expect(result1).toBe(true)
			expect(result2).toBe(true)
			expect(localStorage.getItem('testKey1')).toBe('null')
			expect(localStorage.getItem('testKey2')).toBe('undefined')
		})

		it('should return false when JSON serialization fails', () => {
			// Create an object that cannot be serialized to JSON (circular reference)
			const circularObj: any = { name: 'test' }
			circularObj.self = circularObj

			const result = provider.safelyStoreJson('testKey', circularObj, validOptions)

			expect(result).toBe(false)
			expect(localStorage.getItem('testKey')).toBeNull()
		})
	})
})
