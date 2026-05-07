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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockNavigator } from '../../tests/utils'
import { getBasicPlatformInfo, getEnhancedPlatformInfo } from './platform'

// Mock console.warn to avoid noise in tests
const originalConsoleWarn = console.warn
beforeEach(() => {
	console.warn = vi.fn()
})

afterEach(() => {
	console.warn = originalConsoleWarn
})

describe('platform utilities', () => {
	describe('getBasicPlatformInfo', () => {
		it('should return basic platform info when userAgentData is available', () => {
			mockNavigator({
				language: 'en-US',
				platform: 'Win32',
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				userAgentData: {
					mobile: false,
					platform: 'Windows',
				},
			})

			const result = getBasicPlatformInfo()
			expect(result).toEqual({
				'user_agent.is_automated': false,
				'user_agent.is_bot': false,
				'user_agent.language': 'en-US',
				'user_agent.mobile': false,
				'user_agent.original': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				'user_agent.os.name': 'Windows',
			})
		})

		it('should fallback to navigator.platform when userAgentData is not available', () => {
			mockNavigator({
				language: 'en-GB',
				platform: 'MacIntel',
				userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
			})

			const result = getBasicPlatformInfo()
			expect(result).toEqual({
				'user_agent.is_automated': false,
				'user_agent.is_bot': false,
				'user_agent.language': 'en-GB',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				'user_agent.os.name': 'MacIntel',
			})
		})

		it('should detect bot user agents', () => {
			mockNavigator({
				language: 'en-US',
				platform: 'Win32',
				userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			})

			const result = getBasicPlatformInfo()
			expect(result['user_agent.is_bot']).toBe(true)
			expect(result['user_agent.is_automated']).toBe(false)
		})

		it('should detect automated browsers via navigator.webdriver', () => {
			mockNavigator({
				language: 'en-US',
				platform: 'Win32',
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				webdriver: true,
			})

			const result = getBasicPlatformInfo()
			expect(result['user_agent.is_bot']).toBe(false)
			expect(result['user_agent.is_automated']).toBe(true)
		})

		it('should include experimental browser debug attributes only when requested', () => {
			mockNavigator({
				connection: {
					downlink: 10,
					effectiveType: '4g',
					rtt: 50,
					saveData: false,
				},
				deviceMemory: 8,
				hardwareConcurrency: 12,
				languages: ['en-US', 'cs-CZ'],
				maxTouchPoints: 5,
				userAgentData: {
					brands: [{ brand: 'Chromium', version: '123' }],
					mobile: false,
					platform: 'Windows',
				},
				vendor: 'Google Inc.',
			})

			expect(getBasicPlatformInfo()).not.toHaveProperty('browser.debug.hardware_concurrency')

			const result = getBasicPlatformInfo({ includeDebugInfo: true })
			expect(result).toMatchObject({
				'browser.debug.connection.downlink': 10,
				'browser.debug.connection.effective_type': '4g',
				'browser.debug.connection.rtt': 50,
				'browser.debug.connection.save_data': false,
				'browser.debug.device_memory_gb': 8,
				'browser.debug.hardware_concurrency': 12,
				'browser.debug.languages': '["en-US","cs-CZ"]',
				'browser.debug.max_touch_points': 5,
				'browser.debug.ua.brands': '["Chromium/123"]',
				'browser.debug.vendor': 'Google Inc.',
			})
			expect(result).not.toHaveProperty('browser.debug.feature.local_storage')
			expect(result).not.toHaveProperty('browser.debug.viewport.width')
		})

		it('should skip failing experimental browser debug getters', () => {
			mockNavigator({
				connection: {
					effectiveType: '4g',
				},
				deviceMemory: 8,
				hardwareConcurrency: 12,
			})

			Object.defineProperty(navigator, 'connection', {
				configurable: true,
				get() {
					throw new Error('connection unavailable')
				},
			})
			Object.defineProperty(navigator, 'deviceMemory', {
				configurable: true,
				get() {
					throw new Error('device memory unavailable')
				},
			})

			const result = getBasicPlatformInfo({ includeDebugInfo: true })
			expect(result).toHaveProperty('browser.debug.hardware_concurrency', 12)
			expect(result).not.toHaveProperty('browser.debug.connection.effective_type')
			expect(result).not.toHaveProperty('browser.debug.device_memory_gb')
		})
	})

	describe('getEnhancedPlatformInfo', () => {
		it('should return enhanced platform info when User Agent Client Hints API is available', async () => {
			mockNavigator({
				language: 'en-US',
				platform: 'Win32',
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				userAgentData: {
					getHighEntropyValues: vi.fn().mockResolvedValue({
						platformVersion: '10.0.0',
					}),
					mobile: undefined,
					platform: 'Windows',
				},
			})

			const result = await getEnhancedPlatformInfo()
			expect(result).toEqual({
				'user_agent.is_automated': false,
				'user_agent.is_bot': false,
				'user_agent.language': 'en-US',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				'user_agent.os.name': 'Windows',
				'user_agent.os.version': '10.0.0',
			})
			expect(navigator.userAgentData?.getHighEntropyValues).toHaveBeenCalledWith(['platformVersion'])
		})

		it('should return only available fields when some high entropy values are missing', async () => {
			mockNavigator({
				language: 'en-US',
				platform: 'MacIntel',
				userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				userAgentData: {
					getHighEntropyValues: vi.fn().mockResolvedValue({
						platformVersion: '14.0.0',
					}),
					mobile: undefined,
					platform: 'macOS',
				},
			})

			const result = await getEnhancedPlatformInfo()
			expect(result).toEqual({
				'user_agent.is_automated': false,
				'user_agent.is_bot': false,
				'user_agent.language': 'en-US',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				'user_agent.os.name': 'macOS',
				'user_agent.os.version': '14.0.0',
			})
		})

		it('should fallback to basic info when high entropy values fail', async () => {
			mockNavigator({
				language: 'en-US',
				platform: 'Linux',
				userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
				userAgentData: {
					getHighEntropyValues: vi.fn().mockRejectedValue(new Error('Permission denied')),
					mobile: undefined,
					platform: 'Linux',
				},
			})

			const result = await getEnhancedPlatformInfo()
			expect(result).toEqual({
				'user_agent.is_automated': false,
				'user_agent.is_bot': false,
				'user_agent.language': 'en-US',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
				'user_agent.os.name': 'Linux',
			})
			expect(console.warn).toHaveBeenCalledWith(
				'[Splunk]: Could not get enhanced platform information:',
				expect.any(Error),
			)
		})

		it('should return basic info when User Agent Client Hints API is not available', async () => {
			mockNavigator({
				language: 'en-US',
				platform: 'iPhone',
				userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
			})

			const result = await getEnhancedPlatformInfo()
			expect(result).toEqual({
				'user_agent.is_automated': false,
				'user_agent.is_bot': false,
				'user_agent.language': 'en-US',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				'user_agent.os.name': 'iPhone',
			})
		})

		it('should include enhanced experimental browser debug attributes when requested', async () => {
			const getHighEntropyValues = vi.fn().mockResolvedValue({
				architecture: 'arm',
				bitness: '64',
				fullVersionList: [{ brand: 'Chromium', version: '123.0.1' }],
				model: 'Pixel 8',
				platformVersion: '15.0.0',
				uaFullVersion: '123.0.1',
				wow64: false,
			})
			const estimate = vi.fn().mockResolvedValue({
				quota: 1000,
				usage: 250,
				usageDetails: {
					caches: 150,
					indexedDB: 100,
				},
			})

			mockNavigator({
				deviceMemory: 8,
				hardwareConcurrency: 12,
				storage: { estimate },
				userAgentData: {
					getHighEntropyValues,
					mobile: false,
					platform: 'Android',
				},
			})

			const result = await getEnhancedPlatformInfo({ includeDebugInfo: true })
			expect(result).toMatchObject({
				'browser.debug.device_memory_gb': 8,
				'browser.debug.hardware_concurrency': 12,
				'browser.debug.storage.quota': 1000,
				'browser.debug.storage.usage': 250,
				'browser.debug.storage.usage_details.caches': 150,
				'browser.debug.storage.usage_details.indexed_db': 100,
				'browser.debug.ua.architecture': 'arm',
				'browser.debug.ua.bitness': '64',
				'browser.debug.ua.full_version': '123.0.1',
				'browser.debug.ua.full_version_list': '["Chromium/123.0.1"]',
				'browser.debug.ua.model': 'Pixel 8',
				'browser.debug.ua.wow64': false,
				'user_agent.os.name': 'Android',
				'user_agent.os.version': '15.0.0',
			})
			expect(getHighEntropyValues).toHaveBeenCalledWith([
				'architecture',
				'bitness',
				'fullVersionList',
				'model',
				'platformVersion',
				'uaFullVersion',
				'wow64',
			])
			expect(estimate).toHaveBeenCalled()
		})
	})
})
