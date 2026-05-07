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

import { vi } from 'vitest'

export function mockNavigator(config: {
	connection?: {
		downlink?: number
		effectiveType?: string
		rtt?: number
		saveData?: boolean
		type?: string
	}
	cookieEnabled?: boolean
	deviceMemory?: number
	doNotTrack?: string
	hardwareConcurrency?: number
	language?: string
	languages?: string[]
	maxTouchPoints?: number
	platform?: string
	storage?: {
		estimate?: () => Promise<StorageEstimate>
	}
	userAgent?: string
	userAgentData?: {
		brands?: Array<{
			brand: string
			version: string
		}>
		getHighEntropyValues?: any
		mobile?: boolean
		platform?: string
	}
	vendor?: string
	webdriver?: boolean
}) {
	const mockNav = {
		connection: config.connection,
		cookieEnabled: config.cookieEnabled ?? true,
		deviceMemory: config.deviceMemory,
		doNotTrack: config.doNotTrack,
		hardwareConcurrency: config.hardwareConcurrency,
		language: config.language || 'en-US',
		languages: config.languages,
		maxTouchPoints: config.maxTouchPoints,
		platform: config.platform || 'Win32',
		storage: config.storage,
		userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		vendor: config.vendor,
		webdriver: config.webdriver ?? false,
		...(config.userAgentData && {
			userAgentData: {
				brands: config.userAgentData.brands,
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
}
