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

import { afterEach, describe, expect, it, vi } from 'vitest'

import { LONG_ANIMATION_FRAME_PERFORMANCE_TYPE } from './constants'
import { isLoafInstrumentationEnabled, isLongAnimationFrameSupported } from './support'

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('LoAF support detection', () => {
	it('detects support from PerformanceObserver.supportedEntryTypes', () => {
		stubPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])

		expect(isLongAnimationFrameSupported()).toBe(true)
	})

	it('treats missing or unmatched supportedEntryTypes as unsupported', () => {
		stubPerformanceObserver()
		expect(isLongAnimationFrameSupported()).toBe(false)

		stubPerformanceObserver(['longtask'])
		expect(isLongAnimationFrameSupported()).toBe(false)
	})
})

describe('LoAF instrumentation config', () => {
	it('enables LoAF for true or enabled object configs', () => {
		expect(isLoafInstrumentationEnabled(true)).toBe(true)
		expect(isLoafInstrumentationEnabled({})).toBe(true)
		expect(isLoafInstrumentationEnabled({ enabled: true })).toBe(true)
	})

	it('disables LoAF for missing, false, or disabled object configs', () => {
		expect(isLoafInstrumentationEnabled()).toBe(false)
		expect(isLoafInstrumentationEnabled(false)).toBe(false)
		expect(isLoafInstrumentationEnabled({ enabled: false })).toBe(false)
	})
})

function stubPerformanceObserver(supportedEntryTypes?: string[]): void {
	vi.stubGlobal('PerformanceObserver', { supportedEntryTypes })
}
