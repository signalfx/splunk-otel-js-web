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

import { escapeStringForRegExp, truncateString } from './text'

describe('escapeStringForRegExp', () => {
	it('escapes regular expression metacharacters', () => {
		const escaped = escapeStringForRegExp(String.raw`https://example.com/v1/rum?token=a+b[0]`)

		expect(escaped).toBe(String.raw`https://example\.com/v1/rum\?token=a\+b\[0\]`)
		expect(new RegExp(`^${escaped}$`).test(String.raw`https://example.com/v1/rum?token=a+b[0]`)).toBe(true)
	})

	it('leaves non-metacharacters unchanged', () => {
		expect(escapeStringForRegExp('abc-123/path_value')).toBe('abc-123/path_value')
	})

	it('escapes every JavaScript regular expression metacharacter', () => {
		const value = '.*+?^${}()|[]\\'
		const escaped = escapeStringForRegExp(value)

		expect(new RegExp(`^${escaped}$`).test(value)).toBe(true)
		expect(escaped).toBe(String.raw`\.\*\+\?\^\$\{\}\(\)\|\[\]\\`)
	})
})

describe('truncateString', () => {
	it('returns the original string when it does not exceed the max length', () => {
		expect(truncateString('hello', 5)).toBe('hello')
		expect(truncateString('hello', 10)).toBe('hello')
	})

	it('truncates the string and appends the default suffix', () => {
		const result = truncateString('abcdefghijklmnopqrstuvwxyz', 10)

		expect(result).toBe('abcdefg...')
		expect(result).toHaveLength(10)
	})

	it('supports a custom suffix', () => {
		expect(truncateString('abcdefghijklmnopqrstuvwxyz', 10, '---')).toBe('abcdefg---')
	})

	it('does not exceed the max length when the suffix is longer than the limit', () => {
		expect(truncateString('abcdefghijklmnopqrstuvwxyz', 2)).toBe('..')
		expect(truncateString('abcdefghijklmnopqrstuvwxyz', 0)).toBe('')
	})
})
