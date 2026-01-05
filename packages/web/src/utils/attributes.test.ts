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

import {
	isPlainObject,
	isValidAttributeValue,
	removeEmptyProperties,
	removePropertiesWithAdvancedTypes,
} from './attributes'

describe('isPlainObject', () => {
	it('should be true for plain object', () => {
		expect(isPlainObject({})).toBe(true)
		expect(isPlainObject({ foo: 'bar' })).toBe(true)
	})

	it('should be false for other objects', () => {
		expect(isPlainObject('')).toBe(false)
		expect(isPlainObject(null)).toBe(false)

		class Foo {}
		expect(isPlainObject(new Foo())).toBe(false)
	})
})

describe('isAttributeValue', () => {
	it('should return true for valid primitives', () => {
		expect(isValidAttributeValue('foo')).toBe(true)
		expect(isValidAttributeValue(123)).toBe(true)
		expect(isValidAttributeValue(true)).toBe(true)
	})

	it('should return false for arrays, objects, functions, symbols, and null/undefined', () => {
		expect(isValidAttributeValue(['a', 1, true])).toBe(false)
		expect(isValidAttributeValue(['a', 'b'])).toBe(false)
		expect(isValidAttributeValue([])).toBe(false)
		expect(isValidAttributeValue({})).toBe(false)
		expect(isValidAttributeValue(() => {})).toBe(false)
		expect(isValidAttributeValue(Symbol('s'))).toBe(false)
		expect(isValidAttributeValue(null)).toBe(false)
		// @ts-expect-error No argument on purpose
		expect(isValidAttributeValue()).toBe(false)
	})
})

describe('removePropertiesWithAdvancedTypes', () => {
	it('should not remove primitive types', () => {
		const objWithPrimitives = { boolean: true, empty: null, number: 1, string: 'string' }
		expect(removePropertiesWithAdvancedTypes(objWithPrimitives)).toEqual({
			boolean: true,
			number: 1,
			string: 'string',
		})
	})

	it('should remove function prop', () => {
		expect(removePropertiesWithAdvancedTypes({ fn: () => 1 })).toEqual({})
	})

	it('should remove object prop', () => {
		expect(removePropertiesWithAdvancedTypes({ obj: { foo: 'foo' } })).toEqual({})
	})

	it('should remove symbol prop', () => {
		expect(removePropertiesWithAdvancedTypes({ symbol: Symbol('s') })).toEqual({})
	})

	it('should remove arrays', () => {
		const obj = {
			invalidEmptyArr: [],
			invalidMixedArr: ['a', 1, true],
			invalidObjArr: [{}, null],
			validBoolArr: [true, false],
			validNumberArr: [1, 2],
			validStringArr: ['a', 'b'],
		}
		expect(removePropertiesWithAdvancedTypes(obj)).toEqual({})
	})

	it('should remove null and undefined as top-level values', () => {
		const obj = { a: null, b: undefined, c: 'valid' }
		expect(removePropertiesWithAdvancedTypes(obj)).toEqual({ c: 'valid' })
	})
})

describe('removeEmptyProperties', () => {
	it('should remove empty properties from object', () => {
		expect(removeEmptyProperties({ bar: '', foo: 'foo' })).toEqual({ foo: 'foo' })
		expect(removeEmptyProperties({ bar: undefined, foo: 'foo' })).toEqual({ foo: 'foo' })
		expect(removeEmptyProperties({ bar: null, foo: 'foo' })).toEqual({ foo: 'foo' })
	})
})
