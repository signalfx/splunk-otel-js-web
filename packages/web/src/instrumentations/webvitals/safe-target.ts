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

import type { WebVitalsAttributionConfig } from './types'

import { getResolvedWebVitalsAttributionConfig } from './attribution-config'

const MAX_SAFE_TARGET_LENGTH = 120
const MAX_SAFE_TARGET_DEPTH = 6
const SAFE_ROLE_PATTERN = /^[a-zA-Z][\w-]*$/
const SAFE_TARGET_PART_PATTERN = /^[a-z][a-z0-9-]*(\[role=[a-zA-Z][\w-]*\])?(:nth-of-type\([1-9]\d*\))?$/

export function generateSafeWebVitalsTarget(node: Node | null): string | undefined {
	if (!node || node.nodeType !== Node.ELEMENT_NODE) {
		return undefined
	}

	const parts: string[] = []
	let current: Element | null = node as Element
	// Track accumulated selector length: sum of part lengths plus '>' separators.
	let accumulatedLength = 0

	while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < MAX_SAFE_TARGET_DEPTH) {
		const { hasRole, part } = getSafeElementSelectorPart(current)
		// Stop appending to the chain once adding `part` would exceed the
		// length budget; keep what we already accumulated to ensure the
		// returned value remains a syntactically valid selector. The leaf
		// element (first iteration) is always kept even if it is itself longer
		// than the budget, so callers always receive at least one selector
		// fragment when given an element.
		const tentativeLength = parts.length === 0 ? part.length : accumulatedLength + 1 + part.length
		if (parts.length > 0 && tentativeLength > MAX_SAFE_TARGET_LENGTH) {
			break
		}

		parts.unshift(part)
		accumulatedLength = tentativeLength

		// Once we have reached an element bearing a (safe) ARIA role, stop
		// walking further up the tree: the role is a stable landmark and
		// extending the chain rarely adds diagnostic value.
		if (hasRole) {
			break
		}

		current = current.parentElement
	}

	return parts.join('>')
}

function getSafeElementSelectorPart(element: Element): { hasRole: boolean; part: string } {
	const tagName = element.tagName.toLowerCase()
	const role = element.getAttribute('role')
	const hasRole = role !== null && isSafeRole(role)
	const roleSelector = hasRole ? `[role=${role}]` : ''
	const nthOfType = getNthOfType(element)

	return { hasRole, part: `${tagName}${roleSelector}${nthOfType}` }
}

function isSafeRole(role: string): boolean {
	return SAFE_ROLE_PATTERN.test(role)
}

function getNthOfType(element: Element): string {
	const parent = element.parentElement
	if (!parent) {
		return ''
	}

	const elementTag = element.tagName.toLowerCase()
	const children = parent.children
	let count = 0
	let index = -1
	for (const child of children) {
		if (child.tagName.toLowerCase() === elementTag) {
			count += 1
			if (child === element) {
				index = count
			}
		}
	}

	if (count <= 1) {
		return ''
	}

	return `:nth-of-type(${index})`
}

export function getWebVitalsTargetForAttribution(
	target: string | undefined,
	config?: WebVitalsAttributionConfig,
): string | undefined {
	const targetMode = getResolvedWebVitalsAttributionConfig(config).target
	switch (targetMode) {
		case 'off': {
			return undefined
		}
		case 'raw': {
			return target
		}
		case 'safe': {
			return isSafeGeneratedWebVitalsTarget(target) ? target : undefined
		}
		default: {
			const _exhaustiveCheck: never = targetMode
			void _exhaustiveCheck
			return isSafeGeneratedWebVitalsTarget(target) ? target : undefined
		}
	}
}

export function isSafeGeneratedWebVitalsTarget(target: string | undefined): target is string {
	if (!target || target.length > MAX_SAFE_TARGET_LENGTH) {
		return false
	}

	const parts = target.split('>')
	return (
		parts.length > 0 &&
		parts.length <= MAX_SAFE_TARGET_DEPTH &&
		parts.every((part) => SAFE_TARGET_PART_PATTERN.test(part))
	)
}
