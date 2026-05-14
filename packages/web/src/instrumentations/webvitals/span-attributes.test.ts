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

import { Span } from '@opentelemetry/api'
import { describe, expect, it } from 'vitest'

import { setAttributes, setNumberAttribute, setRectAttributes, setStringAttribute } from './span-attributes'

describe('webvitals span attribute helpers', () => {
	it('sets string attributes including empty strings', () => {
		const { attributes, span } = createSpanMock()

		setStringAttribute(span, 'filled', 'value')
		setStringAttribute(span, 'empty', '')
		setStringAttribute(span, 'missing', undefined)

		expect(attributes).toEqual({
			empty: '',
			filled: 'value',
		})
	})

	it('sets only finite number attributes', () => {
		const { attributes, span } = createSpanMock()

		setNumberAttribute(span, 'zero', 0)
		setNumberAttribute(span, 'negative', -1)
		setNumberAttribute(span, 'missing', undefined)
		setNumberAttribute(span, 'nan', Number.NaN)
		setNumberAttribute(span, 'positive_infinity', Number.POSITIVE_INFINITY)
		setNumberAttribute(span, 'negative_infinity', Number.NEGATIVE_INFINITY)

		expect(attributes).toEqual({
			negative: -1,
			zero: 0,
		})
	})

	it('expands layout shift rectangles into prefixed attributes', () => {
		const { attributes, span } = createSpanMock()

		setRectAttributes(span, 'cls.largest_shift_source.current_rect', {
			height: 40,
			width: 30,
			x: 10,
			y: 20,
		})
		setRectAttributes(span, 'cls.largest_shift_source.previous_rect', undefined)

		expect(attributes).toEqual({
			'cls.largest_shift_source.current_rect.height': 40,
			'cls.largest_shift_source.current_rect.width': 30,
			'cls.largest_shift_source.current_rect.x': 10,
			'cls.largest_shift_source.current_rect.y': 20,
		})
	})

	it('routes mixed record attributes through string and number setters', () => {
		const { attributes, span } = createSpanMock()

		setAttributes(span, {
			empty_string: '',
			finite_number: 42,
			invalid_number: Number.NaN,
			string_value: 'value',
		})

		expect(attributes).toEqual({
			empty_string: '',
			finite_number: 42,
			string_value: 'value',
		})
	})
})

function createSpanMock(): { attributes: Record<string, number | string>; span: Span } {
	const attributes: Record<string, number | string> = {}
	const span = {
		setAttribute: (name: string, value: number | string) => {
			attributes[name] = value
			return span
		},
	} as Span

	return { attributes, span }
}
