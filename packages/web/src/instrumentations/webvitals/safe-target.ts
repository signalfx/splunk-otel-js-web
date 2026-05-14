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

const MAX_SAFE_TARGET_LENGTH = 120
const MAX_SAFE_TARGET_DEPTH = 6

export function generateSafeWebVitalsTarget(node: Node | null): string | undefined {
	if (!node || node.nodeType !== Node.ELEMENT_NODE) {
		return undefined
	}

	const parts: string[] = []
	let current: Element | null = node as Element

	while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < MAX_SAFE_TARGET_DEPTH) {
		const part = getSafeElementSelectorPart(current)
		// Stop appending to the chain once adding `part` would exceed the
		// length budget; keep what we already accumulated to ensure the
		// returned value remains a syntactically valid selector. The leaf
		// element (first iteration) is always kept even if it is itself longer
		// than the budget, so callers always receive at least one selector
		// fragment when given an element.
		const tentative = parts.length === 0 ? part : `${part}>${parts.join('>')}`
		if (parts.length > 0 && tentative.length > MAX_SAFE_TARGET_LENGTH) {
			break
		}

		parts.unshift(part)

		// Once we have reached an element bearing a (safe) ARIA role, stop
		// walking further up the tree: the role is a stable landmark and
		// extending the chain rarely adds diagnostic value.
		if (part.includes('[role=')) {
			break
		}

		current = current.parentElement
	}

	return parts.join('>')
}

function getSafeElementSelectorPart(element: Element): string {
	const tagName = element.tagName.toLowerCase()
	const role = element.getAttribute('role')
	const roleSelector = role && isSafeRole(role) ? `[role=${role}]` : ''
	const nthOfType = getNthOfType(element)

	return `${tagName}${roleSelector}${nthOfType}`
}

function isSafeRole(role: string): boolean {
	return /^[a-zA-Z][\w-]*$/.test(role)
}

function getNthOfType(element: Element): string {
	const parent = element.parentElement
	if (!parent) {
		return ''
	}

	const sameTypeSiblings = Array.from(parent.children).filter(
		(child) => child.tagName.toLowerCase() === element.tagName.toLowerCase(),
	)
	if (sameTypeSiblings.length <= 1) {
		return ''
	}

	return `:nth-of-type(${sameTypeSiblings.indexOf(element) + 1})`
}
