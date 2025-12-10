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

import { isElement } from '../types'

/**
 * Normalizes a data attribute name from `data-test-id` format to `element.dataset.testId` format.
 * Converts to camelCase like the element.dataset property does.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset#name_conversion
 */
export function normalizeDataAttributeName(attrName: string): string {
	// Remove 'data-' prefix and convert to camelCase (same as element.dataset property)
	const suffix = attrName
		.slice(5)
		.toLowerCase()
		.replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase())
	return `element.dataset.${suffix}`
}

/**
 * Converts a camelCase attribute name to hyphenated data-* format.
 * @example 'testId' -> 'data-test-id'
 */
function camelCaseToDataAttribute(name: string): string {
	const hyphenated = name.replaceAll(/([A-Z])/g, '-$1').toLowerCase()
	return `data-${hyphenated}`
}

/**
 * Captures specified data attributes from an element and attaches them to a span.
 * Only data-* attributes are captured
 * Attribute names are normalized to `element.dataset.attributeName` format (camelCase).
 *
 * Accepts both formats:
 * - Hyphenated: 'data-test-id' -> looks up data-test-id, outputs element.dataset.testId
 * - CamelCase: 'testId' -> looks up data-test-id, outputs element.dataset.testId
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset#name_conversion
 */
export function captureElementDataAttributes(span: Span, target: Node, attributeNames?: string[]): void {
	if (!attributeNames || attributeNames.length === 0 || !isElement(target)) {
		return
	}

	for (const attrName of attributeNames) {
		// Convert camelCase to data-* format, or use as-is if already hyphenated
		const dataAttrName = attrName.startsWith('data-') ? attrName : camelCaseToDataAttribute(attrName)

		const attrValue = target.getAttribute(dataAttrName)
		if (attrValue !== null) {
			const normalizedName = normalizeDataAttributeName(dataAttrName)
			span.setAttribute(normalizedName, attrValue)
		}
	}
}
