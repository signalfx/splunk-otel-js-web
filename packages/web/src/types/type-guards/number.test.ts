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

import { isFiniteNumber, isNumber } from './number'

describe('isNumber', () => {
	it('returns true for primitive numbers', () => {
		expect(isNumber(0)).toBe(true)
		expect(isNumber(-1)).toBe(true)
		expect(isNumber(1.5)).toBe(true)
		expect(isNumber(Number.NaN)).toBe(true)
		expect(isNumber(Number.POSITIVE_INFINITY)).toBe(true)
		expect(isNumber(Number.NEGATIVE_INFINITY)).toBe(true)
	})

	it('returns false for non-number values', () => {
		expect(isNumber()).toBe(false)
		expect(isNumber(null)).toBe(false)
		expect(isNumber('1')).toBe(false)
		expect(isNumber(true)).toBe(false)
		expect(isNumber({})).toBe(false)
		expect(isNumber([])).toBe(false)
	})
})

describe('isFiniteNumber', () => {
	it('returns true for finite primitive numbers', () => {
		expect(isFiniteNumber(0)).toBe(true)
		expect(isFiniteNumber(-1)).toBe(true)
		expect(isFiniteNumber(1.5)).toBe(true)
	})

	it('returns false for non-finite numbers and non-number values', () => {
		expect(isFiniteNumber(Number.NaN)).toBe(false)
		expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false)
		expect(isFiniteNumber(Number.NEGATIVE_INFINITY)).toBe(false)
		expect(isFiniteNumber()).toBe(false)
		expect(isFiniteNumber(null)).toBe(false)
		expect(isFiniteNumber('1')).toBe(false)
	})
})
