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

import { getParentNode, traverseElementsToRoot } from '../../utils/index'
import {
	getNodePrivacyInfo,
	mergePrivacyInfo,
	NodePrivacyInfo,
	NodeSensitivityRuleType,
	SensitivityRule,
} from './utils'

interface NodePosition {
	parent: Node | null
}

type NodePrivacyInfoWithPosition = NodePrivacyInfo & NodePosition

export interface PrivacyManagerConfig {
	maskAllText: boolean
	sensitivityRules: SensitivityRule[]
}

export class PrivacyManager {
	static shouldMaskTextNode = (textNode: Node, partialConfig?: Partial<PrivacyManagerConfig>): boolean => {
		const config = {
			maskAllText: true,
			sensitivityRules: [],
			...partialConfig,
		}
		const privacyInfo = this.retrieveNodePrivacyInfo(config, textNode)
		const maskTypes: NodeSensitivityRuleType[] = ['mask', 'exclude']

		if (maskTypes.includes(privacyInfo.sensitivityRuleType)) {
			return true
		}

		if (config.maskAllText && privacyInfo.sensitivityRuleType !== 'unmask') {
			return true
		}

		return false
	}

	private static retrieveNodePrivacyInfo = (
		config: PrivacyManagerConfig,
		node: Node,
	): NodePrivacyInfoWithPosition => {
		const parentNode = getParentNode(node)
		const sensitivityRules = config.sensitivityRules

		const parentPrivacyInfo = parentNode ? getNodePrivacyInfo(parentNode, sensitivityRules) : null
		const nodePrivacyInfo = getNodePrivacyInfo(node, sensitivityRules)
		let finalPrivacyInfo: NodePrivacyInfo

		if (parentPrivacyInfo) {
			finalPrivacyInfo = mergePrivacyInfo(parentPrivacyInfo, nodePrivacyInfo)
		} else {
			finalPrivacyInfo = { ...nodePrivacyInfo }

			for (const traversedNode of traverseElementsToRoot(node)) {
				const traversedNodePrivacyInfo = getNodePrivacyInfo(traversedNode, sensitivityRules)
				finalPrivacyInfo = mergePrivacyInfo(traversedNodePrivacyInfo, finalPrivacyInfo)
			}
		}

		const privacyInfoWithPosition = { ...finalPrivacyInfo, parent: parentNode }

		return privacyInfoWithPosition
	}
}
