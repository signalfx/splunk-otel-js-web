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
import { describe, expect, it } from 'vitest'

import { resolveNavigationMetricsConfig } from './resolve-config'

describe('resolveNavigationMetricsConfig', () => {
	it('defaults to true when neither key is set', () => {
		expect(resolveNavigationMetricsConfig({})).toBe(true)
	})

	it('uses spaMetrics when only the deprecated key is set', () => {
		const spaMetrics = { blockingSelectors: ['.spinner'] }
		expect(resolveNavigationMetricsConfig({ spaMetrics })).toBe(spaMetrics)
	})

	it('uses navigationMetrics when only the new key is set', () => {
		const navigationMetrics = { blockingSelectors: ['.spinner'] }
		expect(resolveNavigationMetricsConfig({ navigationMetrics })).toBe(navigationMetrics)
	})

	it('prefers navigationMetrics over spaMetrics when both are set', () => {
		const navigationMetrics = { blockingSelectors: ['.new-spinner'] }
		const spaMetrics = { blockingSelectors: ['.old-spinner'] }
		expect(resolveNavigationMetricsConfig({ navigationMetrics, spaMetrics })).toBe(navigationMetrics)
	})

	it('lets an explicit navigationMetrics: false win over a set spaMetrics', () => {
		const spaMetrics = { blockingSelectors: ['.spinner'] }
		expect(resolveNavigationMetricsConfig({ navigationMetrics: false, spaMetrics })).toBe(false)
	})

	it('falls back to spaMetrics: false when navigationMetrics is unset', () => {
		expect(resolveNavigationMetricsConfig({ spaMetrics: false })).toBe(false)
	})
})