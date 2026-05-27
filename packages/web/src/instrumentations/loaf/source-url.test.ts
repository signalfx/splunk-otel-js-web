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

import { normalizeLoafSourceUrl } from './source-url'

describe('LoAF source URL normalization', () => {
	it('strips query strings and fragments from http URLs', () => {
		expect(normalizeLoafSourceUrl('/assets/app.js?token=secret#hash')).toBe(`${location.origin}/assets/app.js`)
		expect(normalizeLoafSourceUrl('chunk.js?token=secret#hash')).toBe(`${location.origin}/chunk.js`)
		expect(normalizeLoafSourceUrl('https://example.com/app.js?token=secret#hash')).toBe(
			'https://example.com/app.js',
		)
	})

	it('preserves opaque, non-http, anonymous, empty, and invalid source URLs', () => {
		expect(normalizeLoafSourceUrl('blob:https://example.com/app.js?token=secret#hash')).toBe(
			'blob:https://example.com/app.js?token=secret#hash',
		)
		expect(normalizeLoafSourceUrl('data:text/javascript,alert(1)')).toBe('data:text/javascript,alert(1)')
		expect(normalizeLoafSourceUrl('<anonymous>')).toBe('<anonymous>')
		expect(normalizeLoafSourceUrl('')).toBe('')
		expect(normalizeLoafSourceUrl('not a url')).toBe('not a url')
		expect(normalizeLoafSourceUrl('http://[::1')).toBe('http://[::1')
	})
})
