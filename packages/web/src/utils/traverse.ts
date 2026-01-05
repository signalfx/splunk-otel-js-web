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
import { isNodeNotRecorded, shouldSkipProcessingChildren } from '../filters/index'
import { isDocumentNode, isElement, isNonNativeShadowRoot, isShadowRoot } from '../types/type-guards/index'
import { safelyAccessFrameElementFromDocument } from './iframe'

const getNodePath = (node: Node) => {
	const path = []
	let parentNode = isShadowRoot(node) || isNonNativeShadowRoot(node) ? node.host : node.parentNode
	while (parentNode) {
		path.push(parentNode)

		const nextParentNode = parentNode.parentNode
		parentNode = nextParentNode === null && isShadowRoot(parentNode) ? parentNode.host : nextParentNode
	}

	return path
}

export function* traverseDFS(
	root: Node,
	params: {
		recoverOnNotConnectedNodes?: boolean
		shouldProcessNode?: (node: Node) => boolean
	} = {},
): Generator<Node, void> {
	const { recoverOnNotConnectedNodes, shouldProcessNode } = params

	if (isNodeNotRecorded(root)) {
		return
	}

	if (shouldProcessNode && !shouldProcessNode(root)) {
		return
	}

	const alreadyProcessedNodes = new Set()

	const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
		acceptNode(node: Node): number {
			if (alreadyProcessedNodes.has(node)) {
				return NodeFilter.FILTER_REJECT
			}

			if (isNodeNotRecorded(node)) {
				return NodeFilter.FILTER_REJECT
			}

			if (shouldProcessNode) {
				return shouldProcessNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
			}

			return NodeFilter.FILTER_ACCEPT
		},
	})

	let currentNode: Node | null = treeWalker.currentNode

	while (currentNode) {
		const currentNodePath = getNodePath(currentNode)

		yield currentNode

		if (isElement(currentNode) && currentNode.shadowRoot) {
			yield* traverseDFS(currentNode.shadowRoot, params)
		}

		alreadyProcessedNodes.add(currentNode)

		if (recoverOnNotConnectedNodes) {
			// Node was removed from DOM trying to recover
			if (currentNode.isConnected) {
				const newNodePath = getNodePath(currentNode)
				for (const [index, oldParent] of currentNodePath.entries()) {
					// node moved in tree
					if (newNodePath[index] !== oldParent) {
						treeWalker.currentNode = oldParent
						break
					}
				}
			} else {
				const firstConnectedParent = currentNodePath.find((parentNode) => parentNode.isConnected)
				if (!firstConnectedParent) {
					return
				}

				treeWalker.currentNode = firstConnectedParent
			}
		}

		currentNode = shouldSkipProcessingChildren(treeWalker.currentNode)
			? treeWalker.nextSibling()
			: treeWalker.nextNode()
	}
}

export function* traverseElementsToRoot(node: Node, traverseOnlyToFirstDocumentNode = false): Generator<Element, void> {
	if (traverseOnlyToFirstDocumentNode && isDocumentNode(node)) {
		return
	}

	let currentElement: Element | null = isElement(node) ? node : getParentElement(node)
	while (currentElement) {
		yield currentElement

		if (traverseOnlyToFirstDocumentNode && currentElement.parentNode && isDocumentNode(currentElement.parentNode)) {
			return
		}

		currentElement = getParentElement(currentElement)
	}
}

export const getParentNode = (node: Node) => {
	let parentNode = node.parentNode

	if (parentNode === null) {
		if (isShadowRoot(node) || isNonNativeShadowRoot(node)) {
			parentNode = node.host
		} else if (isDocumentNode(node)) {
			parentNode = safelyAccessFrameElementFromDocument(node)
		}
	}

	return parentNode
}

export const getParentElement = (node: Node) => {
	let parentElement: Element | null = node.parentElement

	if (parentElement === null) {
		if (isShadowRoot(node) || isNonNativeShadowRoot(node)) {
			parentElement = node.host
		} else if (node.parentNode && isDocumentNode(node.parentNode)) {
			parentElement = safelyAccessFrameElementFromDocument(node.parentNode)
		}
	}

	return parentElement
}
