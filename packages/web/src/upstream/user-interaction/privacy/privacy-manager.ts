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

import { isInputElement, isTextInputElement, TextInputElement } from '../../../types'
import {
	traverseDFS,
	getParentNode,
	traverseElementsToRoot,
	isCreditCardInput,
	excludedInputTypes,
} from '../../../utils/index'
import {
	NodePrivacyInfo,
	SensitivityRule,
	NodeSensitivityRuleType,
	getNodePrivacyInfo,
	mergePrivacyInfo,
} from './utils'

interface NodePosition {
	parent: Node | null
}

type NodePrivacyInfoWithPosition = NodePrivacyInfo & NodePosition

export interface PrivacyManagerConfig {
	maskAllInputs: boolean
	maskAllText: boolean
	sensitivityRules: SensitivityRule[]
	useNativeTreeWalker: boolean
}

export class PrivacyManager {
	private privacyInfoByNode = new WeakMap<Node, NodePrivacyInfoWithPosition>()

	constructor(private config: PrivacyManagerConfig) {}

	deleteNodePrivacyInfo = (node: Node): void => {
		this.privacyInfoByNode.delete(node)
	}

	getSensitivityRules = (): SensitivityRule[] => this.config.sensitivityRules

	isCreditCardInput = (inputElement: HTMLInputElement): boolean => isCreditCardInput(inputElement)

	isNodeExcluded = (node: Node): boolean => {
		const privacyInfo = this.retrieveNodePrivacyInfo(node)

		return privacyInfo.sensitivityRuleType === 'exclude'
	}

	isNodeMasked: (node: Node) => boolean = (node: Node): boolean => {
		const privacyInfo = this.retrieveNodePrivacyInfo(node)

		// Just to be sure, we are also masking nodes with 'exclude' rule type.
		const maskTypes: NodeSensitivityRuleType[] = ['mask', 'exclude']
		return maskTypes.includes(privacyInfo.sensitivityRuleType)
	}

	isNodeUnmasked: (node: Node) => boolean = (node: Node): boolean => {
		const privacyInfo = this.retrieveNodePrivacyInfo(node)
		return privacyInfo.sensitivityRuleType === 'unmask'
	}

	isPasswordInput = (node: Node): boolean => this.retrieveNodePrivacyInfo(node).isPasswordInput

	isSensitiveInput = (textInputElement: TextInputElement): boolean =>
		this.isPasswordInput(textInputElement) ||
		(isInputElement(textInputElement) && this.isCreditCardInput(textInputElement)) ||
		excludedInputTypes.has(textInputElement.type)

	recomputeNodePrivacyInfoForNodeAndItsSubtree = (node: Node): void => {
		for (const traversedNode of traverseDFS(node, { useNativeTreeWalker: this.config.useNativeTreeWalker })) {
			this.retrieveAndStoreNodePrivacyInfo(traversedNode)
		}
	}

	retrieveAndStoreNodePrivacyInfo = (node: Node): NodePrivacyInfoWithPosition => {
		const parentNode = getParentNode(node)

		const parentPrivacyInfo = parentNode ? this.privacyInfoByNode.get(parentNode) : null
		const nodePrivacyInfo = getNodePrivacyInfo(node, this.getSensitivityRules())
		let finalPrivacyInfo: NodePrivacyInfo

		if (parentPrivacyInfo) {
			finalPrivacyInfo = mergePrivacyInfo(parentPrivacyInfo, nodePrivacyInfo)
		} else {
			finalPrivacyInfo = { ...nodePrivacyInfo }

			for (const traversedNode of traverseElementsToRoot(node)) {
				const traversedNodePrivacyInfo = getNodePrivacyInfo(traversedNode, this.getSensitivityRules())
				finalPrivacyInfo = mergePrivacyInfo(traversedNodePrivacyInfo, finalPrivacyInfo)
			}

			// TODO: frame masking rules?
		}

		const privacyInfoWithPosition = { ...finalPrivacyInfo, parent: parentNode }
		const oldMetadata = this.privacyInfoByNode.get(node)
		if (oldMetadata && oldMetadata.isPasswordInput) {
			// If the node was previously marked as password input, we should keep this information even
			// if the node is not password input anymore.
			// Some websites change input type from password to text when users clicks "Show password" button.
			privacyInfoWithPosition.isPasswordInput = true
		}

		this.privacyInfoByNode.set(node, privacyInfoWithPosition)
		return privacyInfoWithPosition
	}

	retrieveNodePrivacyInfo = (node: Node): NodePrivacyInfoWithPosition => {
		const privacyInfo = this.privacyInfoByNode.get(node)
		if (privacyInfo === undefined || getParentNode(node) !== privacyInfo.parent) {
			return this.retrieveAndStoreNodePrivacyInfo(node)
		}

		return privacyInfo
	}

	setIsPasswordInput = (inputElement: HTMLInputElement): void => {
		const privacyInfo = this.retrieveNodePrivacyInfo(inputElement)
		this.privacyInfoByNode.set(inputElement, {
			...privacyInfo,
			isPasswordInput: true,
			parent: getParentNode(inputElement),
		})
	}

	shouldMaskInputNode = (inputNode: Node): boolean =>
		this.isNodeMasked(inputNode) ||
		(this.isMaskAllInputsEnabled() && !this.isNodeUnmasked(inputNode)) ||
		(isTextInputElement(inputNode) && this.isSensitiveInput(inputNode))

	shouldMaskTextNode = (textNode: Node): boolean =>
		this.isNodeMasked(textNode) || (this.isMaskAllTextEnabled() && !this.isNodeUnmasked(textNode))

	private isMaskAllInputsEnabled = (): boolean => this.config.maskAllInputs

	private isMaskAllTextEnabled = (): boolean => this.config.maskAllText
}
