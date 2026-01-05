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

import { isElement, isInputElement } from '../../types'
import { getParentElement } from '../../utils/index'

export interface NodePrivacyInfo {
	isPasswordInput: boolean
	sensitivityRuleType: NodeSensitivityRuleType
}

export const SensitivityRuleTypesArray = ['mask', 'unmask', 'exclude'] as const
export type SensitivityRuleType = (typeof SensitivityRuleTypesArray)[number]

export interface SensitivityRule {
	rule: SensitivityRuleType
	selector: string
}

export type NodeSensitivityRuleType = SensitivityRuleType | null

export const maskText = (text: string) => text.replaceAll(/\S/gi, '*')

export const getNodePrivacyInfo = (node: Node, sensitivityRules: SensitivityRule[]): NodePrivacyInfo => ({
	isPasswordInput: isInputElement(node) && node.type === 'password',
	sensitivityRuleType: getSensitivityRuleType(node, sensitivityRules),
})

export const getSensitivityRuleType = (
	node: Node,
	sensitivityRules: SensitivityRule[] = [],
): NodeSensitivityRuleType => {
	let sensitivityRuleType: NodeSensitivityRuleType = null

	// Reverse rules so we can match the most specific rule first.
	const reversedSensitivityRules = sensitivityRules.toReversed()

	// Set correct sensitivity rule type if node matches any of the sensitivity rule selectors.
	for (const sensitivityRule of reversedSensitivityRules) {
		const selectorsWithChildrenMatch = createSelectorsWithChildrenMatch(sensitivityRule.selector)
		const isMatch = selectorsWithChildrenMatch.some(isSelectorMatchingNode(node))
		if (isMatch) {
			sensitivityRuleType = sensitivityRule.rule
			break
		}
	}

	return sensitivityRuleType
}

// Create selectors that match the element and all its children. E.g.: ['.masked', '.masked *']
export const createSelectorsWithChildrenMatch = (originalSelector: string): string[] =>
	originalSelector.split(',').flatMap((selector) => [selector, `${selector} *`])

const isSelectorMatchingNode =
	(node: Node) =>
	(selector: string): boolean => {
		const element = isElement(node) ? node : getParentElement(node)
		if (element === null) {
			return false
		}

		return element.matches(selector)
	}

export const mergePrivacyInfo = (parentPrivacyInfo: NodePrivacyInfo, currentPrivacyInfo: NodePrivacyInfo) => {
	const mergedPrivacyInfo: NodePrivacyInfo = { ...parentPrivacyInfo }

	if (currentPrivacyInfo.isPasswordInput) {
		mergedPrivacyInfo.isPasswordInput = true
	}

	if (mergedPrivacyInfo.sensitivityRuleType !== 'exclude') {
		mergedPrivacyInfo.sensitivityRuleType = currentPrivacyInfo.sensitivityRuleType
	}

	return mergedPrivacyInfo
}
