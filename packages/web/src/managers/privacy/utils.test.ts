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

import { describe, expect, it } from 'vitest'

import { getSensitivityRuleType, SensitivityRule } from './utils'

describe('getSensitivityRuleType', () => {
	it('should return "mask" rule type if node matches mask rule', () => {
		const node = document.createElement('div')
		node.classList.add('masked')
		document.body.append(node)

		const rules: SensitivityRule[] = [{ rule: 'mask', selector: '.masked' }]
		expect(getSensitivityRuleType(node, rules)).toBe('mask')
	})

	it('should return "unmask" rule type if node matches unmask rule', () => {
		const node = document.createElement('div')
		node.classList.add('unmasked')
		document.body.append(node)

		const rules: SensitivityRule[] = [{ rule: 'unmask', selector: '.unmasked' }]
		expect(getSensitivityRuleType(node, rules)).toBe('unmask')
	})

	it('should return "exclude" rule type if node matches exclude rule', () => {
		const node = document.createElement('div')
		node.classList.add('unmasked')
		document.body.append(node)

		const rules: SensitivityRule[] = [{ rule: 'exclude', selector: '.unmasked' }]
		expect(getSensitivityRuleType(node, rules)).toBe('exclude')
	})

	it('should return same rule type for children of matched element', () => {
		const node = document.createElement('div')
		node.classList.add('masked')
		const child = document.createElement('div')
		node.append(child)
		document.body.append(node)

		const rules: SensitivityRule[] = [{ rule: 'mask', selector: '.masked' }]
		expect(getSensitivityRuleType(node, rules)).toBe('mask')
		expect(getSensitivityRuleType(child, rules)).toBe('mask')
	})

	it('should return correct rule if children overrides parent rule', () => {
		const node = document.createElement('div')
		node.classList.add('masked')
		const child = document.createElement('div')
		child.classList.add('unmasked')
		node.append(child)
		document.body.append(node)

		const rules: SensitivityRule[] = [
			{ rule: 'mask', selector: '.masked' },
			{ rule: 'unmask', selector: '.unmasked' },
		]
		expect(getSensitivityRuleType(node, rules)).toBe('mask')
		expect(getSensitivityRuleType(child, rules)).toBe('unmask')
	})

	it("should return null if node doesn't match any rule", () => {
		const node = document.createElement('div')
		document.body.append(node)

		const rules: SensitivityRule[] = [{ rule: 'mask', selector: '.masked' }]
		expect(getSensitivityRuleType(node, rules)).toBe(null)
	})
})
