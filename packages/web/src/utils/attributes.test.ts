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
import { isPlainObject, removeEmptyProperties, removePropertiesWithAdvancedTypes, isAttributeValue } from './attributes'
import { describe, it, expect } from 'vitest'

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
		expect(isAttributeValue('foo')).toBe(true)
		expect(isAttributeValue(123)).toBe(true)
		expect(isAttributeValue(true)).toBe(true)
	})

	it('should return false for objects, functions, symbols, and null/undefined', () => {
		expect(isAttributeValue(['a', 1, true])).toBe(false)
		expect(isAttributeValue(['a'])).toBe(false)
		expect(isAttributeValue({})).toBe(false)
		expect(isAttributeValue(() => {})).toBe(false)
		expect(isAttributeValue(Symbol('s'))).toBe(false)
		expect(isAttributeValue(null)).toBe(false)
		expect(isAttributeValue(undefined)).toBe(false)
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

	it('should remove remove arrays', () => {
		const obj = {
			validStringArr: ['a', 'b'],
			validNumberArr: [1, 2],
			validBoolArr: [true, false],
			invalidMixedArr: ['a', 1, true],
			invalidObjArr: [{}, null],
			invalidEmptyArr: [],
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
