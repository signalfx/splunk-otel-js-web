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

import { getBasicPlatformInfo, getEnhancedPlatformInfo } from './platform'

// Test utility function to mock navigator
function mockNavigator(config: {
	language?: string
	platform?: string
	userAgent?: string
	userAgentData?: {
		getHighEntropyValues?: any
		mobile?: boolean
		platform?: string
	}
}) {
	const mockNav = {
		language: config.language || 'en-US',
		platform: config.platform || 'Win32',
		userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		...(config.userAgentData && {
			userAgentData: {
				getHighEntropyValues: config.userAgentData.getHighEntropyValues || vi.fn().mockResolvedValue({}),
				mobile: config.userAgentData.mobile,
				platform: config.userAgentData.platform || config.platform || 'Windows',
			},
		}),
	}

	Object.defineProperty(globalThis, 'navigator', {
		value: mockNav,
		writable: true,
	})

	return mockNav
}

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
				'user_agent.language': 'en-GB',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				'user_agent.os.name': 'MacIntel',
			})
		})
	})

	describe('getEnhancedPlatformInfo', () => {
		it('should return enhanced platform info when User Agent Client Hints API is available', async () => {
			const mockNav = mockNavigator({
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
				'user_agent.language': 'en-US',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				'user_agent.os.name': 'Windows',
				'user_agent.os.version': '10.0.0',
			})
			expect(mockNav.userAgentData?.getHighEntropyValues).toHaveBeenCalledWith(['platformVersion'])
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
				'user_agent.language': 'en-US',
				'user_agent.mobile': undefined,
				'user_agent.original': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				'user_agent.os.name': 'iPhone',
			})
		})
	})
})
