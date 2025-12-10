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

import { Span } from '@opentelemetry/api'
import { describe, expect, it } from 'vitest'

import { captureElementDataAttributes } from '../src/utils/element-attributes'

describe('captureElementDataAttributes', () => {
	it('should capture only data-* attributes from element', () => {
		const button = document.createElement('button')
		button.dataset.testid = 'submit-button'
		button.dataset.track = 'purchase'
		button.setAttribute('aria-label', 'Submit form')
		button.id = 'submit'

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: string) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, button, ['data-testid', 'data-track', 'aria-label', 'id'])

		expect(attributes['data-testid']).toBe('submit-button')
		expect(attributes['data-track']).toBe('purchase')
		// Non-data attributes should not be captured
		expect(attributes['aria_label']).toBeUndefined()
		expect(attributes['id']).toBeUndefined()
	})

	it('should handle non-existent attributes gracefully', () => {
		const button = document.createElement('button')
		button.dataset.testid = 'my-button'

		const attributes: Record<string, string> = {}
		const mockSpan = {
			setAttribute: (key: string, value: string) => {
				attributes[key] = value
			},
		} as Span

		captureElementDataAttributes(mockSpan, button, ['data-testid', 'non-existent-attr'])

		expect(attributes['data-testid']).toBe('my-button')
		expect(attributes['non-existent-attr']).toBeUndefined()
	})

	it('should not capture attributes if array is empty', () => {
		const button = document.createElement('button')
		button.dataset.testid = 'my-button'

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
})
