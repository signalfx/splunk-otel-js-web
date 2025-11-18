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

import { vi } from 'vitest'

export function mockNavigator(config: {
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
}
