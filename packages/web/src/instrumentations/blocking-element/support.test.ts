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

import { afterEach, describe, expect, it } from 'vitest'

import type { SplunkOtelWebConfig } from '../../types'

import {
	isBlockingElementInstrumentationEnabled,
	resolveBlockingElementSelectors,
	resolveMaxElementSpanDuration,
} from './support'

afterEach(() => {
	location.hash = ''
})

describe('isBlockingElementInstrumentationEnabled', () => {
	it('is disabled when blockingElement is unset and navigationMetrics is unset', () => {
		expect(isBlockingElementInstrumentationEnabled({})).toBe(false)
	})

	it('is disabled when blockingElement is unset and navigationMetrics is false', () => {
		expect(isBlockingElementInstrumentationEnabled({ navigationMetrics: false })).toBe(false)
	})

	it('is disabled when blockingElement is unset and navigationMetrics is true', () => {
		expect(isBlockingElementInstrumentationEnabled({ navigationMetrics: true })).toBe(false)
	})

	it('is disabled when blockingElement is unset and navigationMetrics has blockingSelectors but no elements monitor', () => {
		const config: SplunkOtelWebConfig = {
			navigationMetrics: { blockingSelectors: ['.spinner'], monitors: ['network'] },
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(false)
	})

	it('is disabled when blockingElement is unset and navigationMetrics has elements monitor but no blockingSelectors', () => {
		const config: SplunkOtelWebConfig = {
			navigationMetrics: { monitors: ['elements'] },
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(false)
	})

	it('falls back to enabled when blockingElement is unset and navigationMetrics has elements monitor and blockingSelectors', () => {
		const config: SplunkOtelWebConfig = {
			navigationMetrics: { blockingSelectors: ['.spinner'], monitors: ['elements'] },
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(true)
	})

	it('is enabled when blockingElement is true, regardless of navigationMetrics', () => {
		expect(isBlockingElementInstrumentationEnabled({ instrumentations: { blockingElement: true } })).toBe(true)
	})

	it('is disabled when blockingElement is false, regardless of navigationMetrics having elements+selectors', () => {
		const config: SplunkOtelWebConfig = {
			instrumentations: { blockingElement: false },
			navigationMetrics: { blockingSelectors: ['.spinner'], monitors: ['elements'] },
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(false)
	})

	it('is enabled when blockingElement is an object with no enabled field, falling back to navigationMetrics', () => {
		const config: SplunkOtelWebConfig = {
			instrumentations: { blockingElement: {} },
			navigationMetrics: { blockingSelectors: ['.spinner'], monitors: ['elements'] },
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(true)
	})

	it('is disabled when blockingElement is an object with enabled: false, overriding navigationMetrics', () => {
		const config: SplunkOtelWebConfig = {
			instrumentations: { blockingElement: { enabled: false } },
			navigationMetrics: { blockingSelectors: ['.spinner'], monitors: ['elements'] },
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(false)
	})

	it('is enabled when blockingElement is an object with enabled: true, overriding navigationMetrics', () => {
		const config: SplunkOtelWebConfig = {
			instrumentations: { blockingElement: { enabled: true } },
			navigationMetrics: false,
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(true)
	})

	it('uses the navigationMetrics config for the matching urlOverride, not the base config', () => {
		location.hash = '#elements-page'
		const config: SplunkOtelWebConfig = {
			navigationMetrics: {
				monitors: ['network'],
				urlOverrides: [
					{
						blockingSelectors: ['.spinner'],
						match: '#elements-page',
						monitors: ['elements'],
					},
				],
			},
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(true)
	})

	it('does not apply a urlOverride that does not match the current URL', () => {
		location.hash = '#other-page'
		const config: SplunkOtelWebConfig = {
			navigationMetrics: {
				monitors: ['network'],
				urlOverrides: [
					{
						blockingSelectors: ['.spinner'],
						match: '#elements-page',
						monitors: ['elements'],
					},
				],
			},
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(false)
	})

	it('inherits monitors and blockingSelectors from the base config when a matching urlOverride omits them', () => {
		location.hash = '#cart-page'
		const config: SplunkOtelWebConfig = {
			navigationMetrics: {
				blockingSelectors: ['.loading-spinner'],
				monitors: ['media', 'network', 'performance', 'elements'],
				urlOverrides: [
					{
						match: '#cart-page',
						maxResourcesToWatch: 50,
						quietTime: 1000,
					},
				],
			},
		}
		expect(isBlockingElementInstrumentationEnabled(config)).toBe(true)
	})
})

describe('resolveBlockingElementSelectors', () => {
	it('returns no selectors when blockingElement and navigationMetrics are both unset', () => {
		expect(resolveBlockingElementSelectors({})).toEqual([])
	})

	it('returns no selectors when navigationMetrics is false', () => {
		expect(resolveBlockingElementSelectors({ navigationMetrics: false })).toEqual([])
	})

	it('resolves selectors from navigationMetrics.blockingSelectors regardless of the blockingElement config value', () => {
		const config: SplunkOtelWebConfig = {
			navigationMetrics: { blockingSelectors: ['.spinner'] },
		}
		expect(resolveBlockingElementSelectors(config)).toEqual(['.spinner'])
	})

	it('uses the navigationMetrics config for the matching urlOverride, not the base config', () => {
		location.hash = '#elements-page'
		const config: SplunkOtelWebConfig = {
			navigationMetrics: {
				blockingSelectors: ['.base-spinner'],
				urlOverrides: [
					{
						blockingSelectors: ['.override-spinner'],
						match: '#elements-page',
					},
				],
			},
		}
		expect(resolveBlockingElementSelectors(config)).toEqual(['.override-spinner'])
	})

	it('inherits blockingSelectors from the base config when a matching urlOverride omits it', () => {
		location.hash = '#cart-page'
		const config: SplunkOtelWebConfig = {
			navigationMetrics: {
				blockingSelectors: ['.loading-spinner'],
				urlOverrides: [
					{
						match: '#cart-page',
						maxResourcesToWatch: 50,
						quietTime: 1000,
					},
				],
			},
		}
		expect(resolveBlockingElementSelectors(config)).toEqual(['.loading-spinner'])
	})
})

describe('resolveMaxElementSpanDuration', () => {
	it('returns the default when blockingElement is unset', () => {
		expect(resolveMaxElementSpanDuration({})).toBe(180_000)
	})

	it('returns the default when blockingElement is a boolean', () => {
		expect(resolveMaxElementSpanDuration({ instrumentations: { blockingElement: true } })).toBe(180_000)
	})

	it('returns the default when blockingElement is an object without maxElementSpanDuration', () => {
		expect(resolveMaxElementSpanDuration({ instrumentations: { blockingElement: {} } })).toBe(180_000)
	})

	it('returns the configured override', () => {
		const config: SplunkOtelWebConfig = {
			instrumentations: { blockingElement: { maxElementSpanDuration: 5000 } },
		}
		expect(resolveMaxElementSpanDuration(config)).toBe(5000)
	})
})
