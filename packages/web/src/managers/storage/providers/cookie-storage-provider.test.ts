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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { diag } from '@opentelemetry/api'
import { CookieStorageProvider } from './cookie-storage-provider'
import { StorageOptions } from './base-storage-provider'

vi.mock('@opentelemetry/api', () => ({
	diag: {
		warn: vi.fn(),
	},
}))

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
	writable: true,
	value: '',
})

describe('CookieStorageProvider', () => {
	let provider: CookieStorageProvider
	let mockDiagWarn: ReturnType<typeof vi.fn>

	beforeEach(() => {
		provider = new CookieStorageProvider()
		mockDiagWarn = vi.mocked(diag.warn)
		mockDiagWarn.mockClear()
		// Clear all cookies before each test
		document.cookie = ''
	})

	afterEach(() => {
		// Clean up cookies after each test
		document.cookie = ''
		vi.clearAllMocks()
	})

	describe('providerName', () => {
		it('should return "cookie" as provider name', () => {
			expect(provider.providerName).toBe('cookie')
		})
	})

	describe('getValue', () => {
		it('should return null when no cookies exist', () => {
			document.cookie = ''
			const result = provider.getValue('testKey')
			expect(result).toBeNull()
		})

		it('should return null when key does not exist', () => {
			document.cookie = 'otherKey=otherValue'
			const result = provider.getValue('testKey')
			expect(result).toBeNull()
		})

		it('should return the correct value for existing key', () => {
			document.cookie = 'testKey=testValue'
			const result = provider.getValue('testKey')
			expect(result).toBe('testValue')
		})

		it('should return the correct value when multiple cookies exist', () => {
			document.cookie = 'key1=value1; testKey=testValue; key2=value2'
			const result = provider.getValue('testKey')
			expect(result).toBe('testValue')
		})

		it('should decode URL-encoded values', () => {
			const encodedValue = encodeURIComponent('test value with spaces')
			document.cookie = `testKey=${encodedValue}`
			const result = provider.getValue('testKey')
			expect(result).toBe('test value with spaces')
		})

		it('should handle empty cookie values', () => {
			document.cookie = 'testKey='
			const result = provider.getValue('testKey')
			expect(result).toBe('')
		})

		it('should handle special characters in cookie values', () => {
			const specialValue = encodeURIComponent('{"test": "value", "number": 123}')
			document.cookie = `testKey=${specialValue}`
			const result = provider.getValue('testKey')
			expect(result).toBe('{"test": "value", "number": 123}')
		})

		it('should log warning and return null when cookie parsing fails', () => {
			// Create a spy on document.cookie getter that throws an Error
			const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie')
			const cookieGetterSpy = vi.fn(() => {
				throw new Error('Cookie access denied')
			})

			Object.defineProperty(document, 'cookie', {
				get: cookieGetterSpy,
				configurable: true,
			})

			const result = provider.getValue('testKey')
			expect(result).toBeNull()
			expect(mockDiagWarn).toHaveBeenCalledWith('Failed to retrieve cookie', {
				key: 'testKey',
				error: 'Cookie access denied',
			})

			// Restore original descriptor
			if (originalDescriptor) {
				Object.defineProperty(document, 'cookie', originalDescriptor)
			} else {
				Object.defineProperty(document, 'cookie', {
					writable: true,
					value: '',
					configurable: true,
				})
			}
		})

		it('should handle unknown error types', () => {
			// Create a spy on document.cookie getter that throws a non-Error object
			const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie')
			const cookieGetterSpy = vi.fn(() => {
				throw 'String error'
			})

			Object.defineProperty(document, 'cookie', {
				get: cookieGetterSpy,
				configurable: true,
			})

			const result = provider.getValue('testKey')
			expect(result).toBeNull()
			expect(mockDiagWarn).toHaveBeenCalledWith('Failed to retrieve cookie', {
				key: 'testKey',
				error: 'Unknown error',
			})

			// Restore original descriptor
			if (originalDescriptor) {
				Object.defineProperty(document, 'cookie', originalDescriptor)
			} else {
				Object.defineProperty(document, 'cookie', {
					writable: true,
					value: '',
					configurable: true,
				})
			}
		})
	})

	describe('setValue', () => {
		const validOptions: StorageOptions = {
			domain: 'example.com',
			expires: 'Wed, 21 Oct 2025 07:28:00 GMT',
			sessionPersistence: 'cookie',
		}

		it('should return false and log warning when domain is not provided', () => {
			const result = provider.setValue('testKey', 'testValue', {
				expires: 'Wed, 21 Oct 2025 07:28:00 GMT',
				sessionPersistence: 'cookie',
			})

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Domain is required for cookie storage')
		})

		it('should return false and log warning when expires is not provided', () => {
			const result = provider.setValue('testKey', 'testValue', {
				domain: 'example.com',
				sessionPersistence: 'cookie',
			})

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Expires is required for cookie storage')
		})

		it('should return false and log warning when options are not provided', () => {
			const result = provider.setValue('testKey', 'testValue')

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Domain is required for cookie storage')
		})

		it('should successfully set a cookie with valid options', () => {
			const result = provider.setValue('testKey', 'testValue', validOptions)

			expect(result).toBe(true)
			expect(document.cookie).toContain('testKey=testValue')
			expect(document.cookie).toContain('domain=example.com')
			expect(document.cookie).toContain('expires=Wed, 21 Oct 2025 07:28:00 GMT')
			expect(document.cookie).toContain('path=/')
			expect(document.cookie).toContain('sameSite=strict')
			expect(document.cookie).toContain('secure')
		})

		it('should URL-encode cookie values', () => {
			const valueWithSpaces = 'test value with spaces'
			const result = provider.setValue('testKey', valueWithSpaces, validOptions)

			expect(result).toBe(true)
			const encodedValue = encodeURIComponent(valueWithSpaces)
			expect(document.cookie).toContain(`testKey=${encodedValue}`)
		})

		it('should handle special characters in values', () => {
			const specialValue = '{"test": "value", "number": 123}'
			const result = provider.setValue('testKey', specialValue, validOptions)

			expect(result).toBe(true)
			const encodedValue = encodeURIComponent(specialValue)
			expect(document.cookie).toContain(`testKey=${encodedValue}`)
		})

		it('should handle empty string values', () => {
			const result = provider.setValue('testKey', '', validOptions)

			expect(result).toBe(true)
			expect(document.cookie).toContain('testKey=')
		})

		it('should log warning and return false when cookie setting fails', () => {
			// Create a spy on document.cookie setter that throws an error
			const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie')
			const cookieSetterSpy = vi.fn(() => {
				throw new Error('Cookie setting failed')
			})

			Object.defineProperty(document, 'cookie', {
				set: cookieSetterSpy,
				get: () => '',
				configurable: true,
			})

			const result = provider.setValue('testKey', 'testValue', validOptions)

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Failed to set cookie', {
				key: 'testKey',
				domain: 'example.com',
				error: expect.any(Error),
			})

			// Restore original descriptor
			if (originalDescriptor) {
				Object.defineProperty(document, 'cookie', originalDescriptor)
			} else {
				Object.defineProperty(document, 'cookie', {
					writable: true,
					value: '',
					configurable: true,
				})
			}
		})
	})

	describe('removeValue', () => {
		const validOptions: StorageOptions = {
			domain: 'example.com',
			sessionPersistence: 'cookie',
		}

		it('should return false and log warning when domain is not provided', () => {
			const result = provider.removeValue('testKey', {
				sessionPersistence: 'cookie',
			})

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Domain is required for cookie removal')
		})

		it('should return false and log warning when options are not provided', () => {
			const result = provider.removeValue('testKey')

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Domain is required for cookie removal')
		})

		it('should successfully remove a cookie with valid options', () => {
			const result = provider.removeValue('testKey', validOptions)

			expect(result).toBe(true)
			expect(document.cookie).toContain('testKey=')
			expect(document.cookie).toContain('expires=Thu, 01 Jan 1970 00:00:01 GMT')
			expect(document.cookie).toContain('domain=example.com')
			expect(document.cookie).toContain('path=/')
		})

		it('should set expiration to epoch time for removal', () => {
			const result = provider.removeValue('testKey', validOptions)

			expect(result).toBe(true)
			expect(document.cookie).toContain('expires=Thu, 01 Jan 1970 00:00:01 GMT')
		})

		it('should log warning and return false when cookie removal fails', () => {
			// Create a spy on document.cookie setter that throws an error
			const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie')
			const cookieSetterSpy = vi.fn(() => {
				throw new Error('Cookie removal failed')
			})

			const originalValue = document.cookie
			Object.defineProperty(document, 'cookie', {
				set: cookieSetterSpy,
				get: () => originalValue,
				configurable: true,
			})

			const result = provider.removeValue('testKey', validOptions)

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Failed to remove cookie', {
				key: 'testKey',
				domain: 'example.com',
				error: expect.any(Error),
			})

			// Restore original descriptor
			if (originalDescriptor) {
				Object.defineProperty(document, 'cookie', originalDescriptor)
			} else {
				Object.defineProperty(document, 'cookie', {
					writable: true,
					value: originalValue,
					configurable: true,
				})
			}
		})
	})

	describe('safelyParseJson', () => {
		it('should return undefined when key does not exist', () => {
			const result = provider.safelyParseJson('nonExistentKey')
			expect(result).toBeUndefined()
		})

		it('should return undefined when value is empty', () => {
			document.cookie = 'testKey='
			const result = provider.safelyParseJson('testKey')
			expect(result).toBeUndefined()
		})

		it('should successfully parse valid JSON', () => {
			const testData = { name: 'test', value: 123 }
			const jsonString = JSON.stringify(testData)
			document.cookie = `testKey=${encodeURIComponent(jsonString)}`

			const result = provider.safelyParseJson<typeof testData>('testKey')
			expect(result).toEqual(testData)
		})

		it('should return undefined and log warning for invalid JSON', () => {
			document.cookie = 'testKey=invalid-json'

			const result = provider.safelyParseJson('testKey')
			expect(result).toBeUndefined()
			expect(mockDiagWarn).toHaveBeenCalledWith('Failed to parse JSON from cookie', {
				key: 'testKey',
				value: 'invalid-json',
				error: expect.stringContaining('Unexpected token'),
			})
		})

		it('should handle complex nested objects', () => {
			const complexData = {
				user: {
					id: 123,
					name: 'John Doe',
					preferences: {
						theme: 'dark',
						notifications: true,
					},
				},
				sessions: ['session1', 'session2'],
			}
			const jsonString = JSON.stringify(complexData)
			document.cookie = `testKey=${encodeURIComponent(jsonString)}`

			const result = provider.safelyParseJson<typeof complexData>('testKey')
			expect(result).toEqual(complexData)
		})
	})

	describe('safelyStoreJson', () => {
		const validOptions: StorageOptions = {
			domain: 'example.com',
			expires: 'Wed, 21 Oct 2025 07:28:00 GMT',
			sessionPersistence: 'cookie',
		}

		it('should return false when domain is not provided', () => {
			const testData = { name: 'test' }
			const result = provider.safelyStoreJson('testKey', testData, {
				expires: 'Wed, 21 Oct 2025 07:28:00 GMT',
				sessionPersistence: 'cookie',
			})

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Domain is required for cookie storage')
		})

		it('should successfully store JSON data', () => {
			const testData = { name: 'test', value: 123 }
			const result = provider.safelyStoreJson('testKey', testData, validOptions)

			expect(result).toBe(true)
			const expectedJson = JSON.stringify(testData)
			const encodedJson = encodeURIComponent(expectedJson)
			expect(document.cookie).toContain(`testKey=${encodedJson}`)
		})

		it('should handle complex nested objects', () => {
			const complexData = {
				user: {
					id: 123,
					name: 'John Doe',
					preferences: {
						theme: 'dark',
						notifications: true,
					},
				},
				sessions: ['session1', 'session2'],
			}
			const result = provider.safelyStoreJson('testKey', complexData, validOptions)

			expect(result).toBe(true)
			const expectedJson = JSON.stringify(complexData)
			const encodedJson = encodeURIComponent(expectedJson)
			expect(document.cookie).toContain(`testKey=${encodedJson}`)
		})

		it('should handle arrays', () => {
			const arrayData = [1, 2, 3, 'test', { nested: true }]
			const result = provider.safelyStoreJson('testKey', arrayData, validOptions)

			expect(result).toBe(true)
			const expectedJson = JSON.stringify(arrayData)
			const encodedJson = encodeURIComponent(expectedJson)
			expect(document.cookie).toContain(`testKey=${encodedJson}`)
		})

		it('should handle null and undefined values', () => {
			const result1 = provider.safelyStoreJson('testKey1', null, validOptions)
			const result2 = provider.safelyStoreJson('testKey2', undefined, validOptions)

			expect(result1).toBe(true)
			expect(result2).toBe(true)
			expect(document.cookie).toContain('testKey1=null')
			expect(document.cookie).toContain('testKey2=')
		})

		it('should return false and log warning when JSON serialization fails', () => {
			// Create an object that cannot be serialized to JSON (circular reference)
			const circularObj: any = { name: 'test' }
			circularObj.self = circularObj

			const result = provider.safelyStoreJson('testKey', circularObj, validOptions)

			expect(result).toBe(false)
			expect(mockDiagWarn).toHaveBeenCalledWith('Failed to serialize and store JSON in cookie', {
				key: 'testKey',
				data: circularObj,
				error: expect.stringContaining('circular'),
			})
		})

		it('should return false when underlying setValue fails', () => {
			// Create a spy on document.cookie setter that throws an error
			const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie')
			const cookieSetterSpy = vi.fn(() => {
				throw new Error('Cookie setting failed')
			})

			const originalValue = document.cookie
			Object.defineProperty(document, 'cookie', {
				set: cookieSetterSpy,
				get: () => originalValue,
				configurable: true,
			})

			const testData = { name: 'test' }
			const result = provider.safelyStoreJson('testKey', testData, validOptions)

			expect(result).toBe(false)

			// Restore original descriptor
			if (originalDescriptor) {
				Object.defineProperty(document, 'cookie', originalDescriptor)
			} else {
				Object.defineProperty(document, 'cookie', {
					writable: true,
					value: originalValue,
					configurable: true,
				})
			}
		})
	})

	describe('Integration tests', () => {
		const validOptions: StorageOptions = {
			domain: 'example.com',
			expires: 'Wed, 21 Oct 2025 07:28:00 GMT',
			sessionPersistence: 'cookie',
		}

		it('should store and retrieve string values correctly', () => {
			const testValue = 'test string value'
			const setResult = provider.setValue('testKey', testValue, validOptions)
			expect(setResult).toBe(true)

			const retrievedValue = provider.getValue('testKey')
			expect(retrievedValue).toBe(testValue)
		})

		it('should store and retrieve JSON values correctly', () => {
			const testData = { name: 'John', age: 30, active: true }
			const storeResult = provider.safelyStoreJson('testKey', testData, validOptions)
			expect(storeResult).toBe(true)

			const retrievedData = provider.safelyParseJson<typeof testData>('testKey')
			expect(retrievedData).toEqual(testData)
		})

		it('should handle the complete lifecycle: set, get, remove', () => {
			const testValue = 'lifecycle test'

			// Set
			const setResult = provider.setValue('testKey', testValue, validOptions)
			expect(setResult).toBe(true)

			// Get
			const retrievedValue = provider.getValue('testKey')
			expect(retrievedValue).toBe(testValue)

			// Remove
			const removeResult = provider.removeValue('testKey', validOptions)
			expect(removeResult).toBe(true)

			// Verify removal (note: in real browsers, the cookie would be expired and not accessible)
			// In our test environment, we can still see the cookie but it has an expired date
			expect(document.cookie).toContain('expires=Thu, 01 Jan 1970 00:00:01 GMT')
		})

		it('should handle multiple cookies independently', () => {
			const value1 = 'first value'
			const value2 = 'second value'
			const data3 = { complex: 'object', number: 42 }

			// Set multiple values
			expect(provider.setValue('key1', value1, validOptions)).toBe(true)
			expect(provider.setValue('key2', value2, validOptions)).toBe(true)
			expect(provider.safelyStoreJson('key3', data3, validOptions)).toBe(true)

			// Retrieve and verify
			expect(provider.getValue('key1')).toBe(value1)
			expect(provider.getValue('key2')).toBe(value2)
			expect(provider.safelyParseJson('key3')).toEqual(data3)

			// Remove one and verify others remain accessible
			expect(provider.removeValue('key2', validOptions)).toBe(true)
			expect(provider.getValue('key1')).toBe(value1)
			expect(provider.safelyParseJson('key3')).toEqual(data3)
		})
	})
})
