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

import {
	captureElementDataAttributes,
	getElementDataAttributes,
	normalizeDataAttributeName,
	resolveDataAttributesToCapture,
} from './element-attributes'

describe('normalizeDataAttributeName', () => {
	it('should convert data-test-id to element.dataset.testId', () => {
		expect(normalizeDataAttributeName('data-test-id')).toBe('element.dataset.testId')
	})

	it('should convert data-testid to element.dataset.testid', () => {
		expect(normalizeDataAttributeName('data-testid')).toBe('element.dataset.testid')
	})

	it('should handle multiple hyphens', () => {
		expect(normalizeDataAttributeName('data-my-custom-attr')).toBe('element.dataset.myCustomAttr')
	})

	it('should lowercase uppercase characters', () => {
		expect(normalizeDataAttributeName('data-TestID')).toBe('element.dataset.testid')
	})
})

describe('captureElementDataAttributes', () => {
	it('should capture only data-* attributes from element', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'submit-button'
		button.dataset.track = 'purchase'
		button.setAttribute('aria-label', 'Submit form')
		button.id = 'submit'

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: string) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, button, ['data-test-id', 'data-track', 'aria-label', 'id'])

		expect(attributes['element.dataset.testId']).toBe('submit-button')
		expect(attributes['element.dataset.track']).toBe('purchase')
		// Non-data attributes should not be captured
		expect(attributes['aria_label']).toBeUndefined()
		expect(attributes['id']).toBeUndefined()
	})

	it('should handle non-existent attributes gracefully', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'my-button'

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: string) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, button, ['data-test-id', 'non-existent-attr'])

		expect(attributes['element.dataset.testId']).toBe('my-button')
		expect(attributes['non-existent-attr']).toBeUndefined()
	})

	it('should not capture attributes if array is empty', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'my-button'

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: string) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, button, [])

		expect(Object.keys(attributes)).toHaveLength(0)
	})

	it('should not capture attributes if target is not an Element', () => {
		const textNode = document.createTextNode('text')

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: any) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, textNode, ['data-testid'])

		expect(Object.keys(attributes)).toHaveLength(0)
	})

	it('should accept camelCase attribute names without data- prefix', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'submit-button'
		button.dataset.userName = 'john'

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: string) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, button, ['testId', 'userName'])

		expect(attributes['element.dataset.testId']).toBe('submit-button')
		expect(attributes['element.dataset.userName']).toBe('john')
	})

	it('should accept both camelCase and hyphenated formats in same array', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'my-id'
		button.dataset.track = 'click'

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: string) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, button, ['testId', 'data-track'])

		expect(attributes['element.dataset.testId']).toBe('my-id')
		expect(attributes['element.dataset.track']).toBe('click')
	})
})

describe('getElementDataAttributes', () => {
	it('should return data-* attributes keyed by actual attribute name', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'submit-button'
		button.dataset.track = 'purchase'

		expect(getElementDataAttributes(button, ['data-test-id', 'data-track'])).toEqual({
			'data-test-id': 'submit-button',
			'data-track': 'purchase',
		})
	})

	it('should accept camelCase names without data- prefix', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'submit-button'
		button.dataset.userName = 'john'

		expect(getElementDataAttributes(button, ['testId', 'userName'])).toEqual({
			'data-test-id': 'submit-button',
			'data-user-name': 'john',
		})
	})

	it('should omit missing and non-data attributes', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'submit-button'
		button.id = 'submit'

		expect(getElementDataAttributes(button, ['data-test-id', 'data-track', 'id'])).toEqual({
			'data-test-id': 'submit-button',
		})
	})

	it('should return an empty object for empty config', () => {
		const button = document.createElement('button')
		button.dataset.testId = 'submit-button'

		expect(getElementDataAttributes(button, [])).toEqual({})
	})

	it('should return an empty object for non-elements', () => {
		const textNode = document.createTextNode('text')

		expect(getElementDataAttributes(textNode, ['data-testid'])).toEqual({})
	})
})

describe('resolveDataAttributesToCapture', () => {
	it('should prefer stable dataAttributesToCapture over legacy experimental config', () => {
		expect(
			resolveDataAttributesToCapture({
				_experimental_dataAttributesToCapture: ['data-legacy'],
				dataAttributesToCapture: ['data-stable'],
			}),
		).toEqual(['data-stable'])
	})

	it('should fall back to legacy experimental config', () => {
		expect(
			resolveDataAttributesToCapture({
				_experimental_dataAttributesToCapture: ['data-legacy'],
			}),
		).toEqual(['data-legacy'])
	})
})
