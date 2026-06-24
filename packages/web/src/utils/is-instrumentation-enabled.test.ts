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

import { isInstrumentationEnabled } from './is-instrumentation-enabled'

describe('isInstrumentationEnabled', () => {
	const pluginDefaults = { enabled: false, ignoreUrls: [/beacon/] }

	it('returns false when instrumentation is explicitly false', () => {
		expect(isInstrumentationEnabled({ fetch: false }, 'fetch', pluginDefaults, false)).toBe(false)
	})

	it('returns false when instrumentation config has enabled false', () => {
		expect(isInstrumentationEnabled({ fetch: { enabled: false } }, 'fetch', pluginDefaults, false)).toBe(false)
	})

	it('returns true when instrumentation is explicitly true', () => {
		expect(isInstrumentationEnabled({ fetch: true }, 'fetch', pluginDefaults, false)).toBe(true)
	})

	it('returns true when instrumentation config does not disable it', () => {
		expect(isInstrumentationEnabled({ fetch: { ignoreUrls: [/api/] } }, 'fetch', pluginDefaults, false)).toBe(true)
	})

	it('returns true for undefined instrumentation when defaultDisable is false', () => {
		expect(isInstrumentationEnabled({}, 'fetch', pluginDefaults, false)).toBe(true)
	})

	it('returns false for undefined instrumentation when defaultDisable is true', () => {
		expect(isInstrumentationEnabled({}, 'websocket', pluginDefaults, true)).toBe(false)
	})
})
