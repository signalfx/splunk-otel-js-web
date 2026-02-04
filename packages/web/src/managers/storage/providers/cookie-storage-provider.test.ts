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

import { server } from '@vitest/browser/context'
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { SESSION_EXPIRATION_COOKIE_SEC } from '../constants'
import { CookieStorageProvider } from './cookie-storage-provider'

const validOptions = {
	expires: SESSION_EXPIRATION_COOKIE_SEC,
} as const

describe('CookieStorageProvider', () => {
	let provider: CookieStorageProvider
	let setCookieNames: Set<string>
	let cookieSetterSpy: Mock

	beforeEach(() => {
		provider = new CookieStorageProvider()
		setCookieNames = new Set()

		const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
		cookieSetterSpy = vi.spyOn(document, 'cookie', 'set').mockImplementation((cookieString: string) => {
			const [keyValue] = cookieString.split(';')
			const [key] = keyValue.split('=')
			const cookieName = key.trim()
			setCookieNames.add(cookieName)
			originalDescriptor?.set?.call(document, cookieString)
		})
	})

	afterEach(() => {
		clearTestCookies()
		cookieSetterSpy.mockRestore()
		vi.clearAllMocks()
	})

	const clearTestCookies = () => {
		setCookieNames.forEach((cookieName) => {
			document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/`
		})
		setCookieNames.clear()
	}

	describe('providerName', () => {
		it('should return "cookie" as provider name', () => {
			expect(provider.providerName).toBe('cookie')
		})
	})

	describe('getValue', () => {
		it('should return null when no cookies exist', () => {
			const result = provider.getValue('testKey')
			expect(result).toBeNull()
		})

		it('should return null when key does not exist', () => {
			document.cookie = 'otherKey=otherValue; path=/'
			const result = provider.getValue('testKey')
			expect(result).toBeNull()
		})

		it('should return the correct value for existing key', () => {
			document.cookie = 'testKey=testValue; path=/'
			const result = provider.getValue('testKey')
			expect(result).toBe('testValue')
		})

		it('should return the correct value when multiple cookies exist', () => {
			document.cookie = 'key1=value1; path=/'
			document.cookie = 'testKey=testValue; path=/'
			document.cookie = 'key2=value2; path=/'

			const result = provider.getValue('testKey')
			expect(result).toBe('testValue')
			expect(document.cookie).toContain('key1=value1')
			expect(document.cookie).toContain('testKey=testValue')
			expect(document.cookie).toContain('key2=value2')
		})

		it('should handle expired cookies (not return them)', () => {
			// Set an expired cookie
			const pastDate = new Date(Date.now() - 1000).toUTCString()
			document.cookie = `expiredKey=expiredValue; expires=${pastDate}; path=/`

			// Set a valid cookie
			document.cookie = 'validKey=validValue; path=/'

			// Expired cookie should not be accessible
			expect(provider.getValue('expiredKey')).toBeNull()
			expect(provider.getValue('validKey')).toBe('validValue')

			// document.cookie should only show valid cookies
			expect(document.cookie).not.toContain('expiredKey')
			expect(document.cookie).toContain('validKey=validValue')
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
	})

	describe.runIf(server.browser !== 'webkit')('setValue', () => {
		it('should successfully set a cookie with valid options', () => {
			const result = provider.setValue('testKey', 'testValue', validOptions)

			expect(result).toBe(true)
			expect(document.cookie).toBe('testKey=testValue')
		})

		it('should URL-encode cookie values', () => {
			const valueWithSpaces = 'test value with spaces'
			const result = provider.setValue('testKey', valueWithSpaces, validOptions)

			expect(result).toBe(true)
			const encodedValue = encodeURIComponent(valueWithSpaces)
			expect(document.cookie).toContain(`testKey=${encodedValue}`)
		})
	})

	describe('removeValue', () => {
		it('should successfully remove a cookie with valid options', () => {
			const result = provider.removeValue('testKey', validOptions)

			expect(result).toBe(true)
			expect(document.cookie).toBe('')
		})
	})
	//
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

		it('should return undefined for invalid JSON', () => {
			document.cookie = 'testKey=invalid-json'

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
			document.cookie = `testKey=${encodeURIComponent(jsonString)}`

			const result = provider.safelyParseJson<typeof complexData>('testKey')
			expect(result).toEqual(complexData)
		})
	})

	describe.runIf(server.browser !== 'webkit')('safelyStoreJson', () => {
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
			const encodedJson = encodeURIComponent(expectedJson)
			expect(document.cookie).toContain(`testKey=${encodedJson}`)
		})
	})
})
