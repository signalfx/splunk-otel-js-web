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
export class CustomTreeWalker {
	currentNode: Node

	nodeFilter: { acceptNode(node: Node): number } | null

	root: Node

	whatToShow: number

	private active: boolean = false

	constructor(rootNode: Node, whatToShow?: number, nodeFilter?: { acceptNode(node: Node): number } | null) {
		this.root = rootNode
		this.currentNode = rootNode
		this.whatToShow = whatToShow ?? NodeFilter.SHOW_ALL
		this.nodeFilter = nodeFilter ?? null
	}

	static createTreeWalker = (root: Node, whatToShow?: number, filter?: { acceptNode(node: Node): number } | null) =>
		new CustomTreeWalker(root, whatToShow, filter)

	nextNode() {
		// Spec https://dom.spec.whatwg.org/#dom-treewalker-nextnode
		// 1. Let node be this’s current.
		let node: Node | null = this.currentNode
		// 2. Let result be FILTER_ACCEPT.
		let result: number = NodeFilter.FILTER_ACCEPT

		// 3. While true:
		while (true) {
			// 1. While result is not FILTER_REJECT and node has a child:
			while (result !== NodeFilter.FILTER_REJECT && node?.firstChild) {
				// 1. Set node to its first child.
				node = node.firstChild
				// 2. Set result to the result of filtering node within this.
				result = this.filter(node)
				// 3. If result is FILTER_ACCEPT, then set this’s current to node and return node.
				if (result === NodeFilter.FILTER_ACCEPT) {
					this.currentNode = node
					return node
				}
			}
			// 2. Let sibling be null.
			let sibling = null
			// 3. Let temporary be node.
			let temporary: Node | null = node

			// 4. While temporary is non-null:
			while (temporary !== null) {
				// 1. If temporary is this’s root, then return null.
				if (temporary === this.root) {
					return null
				}

				// 2. Set sibling to temporary’s next sibling.
				sibling = temporary.nextSibling
				// 3. If sibling is non-null, then set node to sibling and break.
				if (sibling !== null) {
					node = sibling
					break
				}

				// 4. Set temporary to temporary’s parent.
				temporary = temporary.parentNode
			}

			// 5. Set result to the result of filtering node within this.
			result = this.filter(node)
			// 6. If result is FILTER_ACCEPT, then set this’s current to node and return node.
			if (result === NodeFilter.FILTER_ACCEPT) {
				this.currentNode = node
				return node
			}
		}
	}

	nextSibling() {
		// Spec: https://dom.spec.whatwg.org/#concept-traverse-siblings
		// 1. Let node be walker’s current.
		let node: Node | null = this.currentNode
		// 2. If node is root, then return null.
		if (node === this.root) {
			return null
		}

		// 3. While true:
		while (true) {
			// 1. Let sibling be node’s next sibling if type is next, and node’s previous sibling if type is previous.
			let sibling: Node | null = node.nextSibling
			// 2. While sibling is non-null:
			while (sibling !== null) {
				// 1. Set node to sibling.
				node = sibling
				// 2. Let result be the result of filtering node within walker.
				const result = this.filter(node)
				if (result === NodeFilter.FILTER_ACCEPT) {
					// 3. If result is FILTER_ACCEPT, then set walker’s current to node and return node.
					this.currentNode = node
					return node
				}

				// 4. Set sibling to node’s first child if type is next, and node’s last child if type is previous.
				sibling = node.firstChild
				if (result === NodeFilter.FILTER_REJECT || sibling === null) {
					// 5. If result is FILTER_REJECT or sibling is null, then set sibling to node’s next sibling if type is next, and node’s previous sibling if type is previous.
					sibling = node.nextSibling
				}
			}

			// 3. Set node to node’s parent.
			node = node.parentNode
			// 4. If node is null or walker’s root, then return null.
			if (node === null || node === this.root) {
				return null
			}

			// 5. If the return value of filtering node within walker is FILTER_ACCEPT, then return null.
			if (this.filter(node) === NodeFilter.FILTER_ACCEPT) {
				return null
			}
		}
	}

	parentNode() {
		// Spec: https://dom.spec.whatwg.org/#dom-treewalker-parentnode
		// 1. Let node be this’s current.
		let node: Node | null = this.currentNode

		// 2. While node is non-null and is not this’s root:
		while (node !== null && node !== this.root) {
			// 1. Set node to node’s parent.
			node = node.parentNode

			// 2. If node is non-null and filtering node within this returns FILTER_ACCEPT, then set this’s current to node and return node.
			if (node !== null && this.filter(node) === NodeFilter.FILTER_ACCEPT) {
				this.currentNode = node
				return node
			}
		}

		// 3. Return null.
		return null
	}

	private filter(node: Node): number {
		// Spec: https://dom.spec.whatwg.org/#concept-node-filter
		// 1. If traverser’s active flag is set, then throw an "InvalidStateError" DOMException.
		if (this.active) {
			throw new Error('CustomTreeWalker is in an invalid state.')
		}

		// 2. Let n be node’s nodeType attribute value − 1.
		const n = node.nodeType - 1

		// 3. If the nth bit (where 0 is the least significant bit) of traverser’s whatToShow is not set, then return FILTER_SKIP.
		if (!(this.whatToShow & (1 << n))) {
			return NodeFilter.FILTER_SKIP
		}

		// 4. If traverser’s filter is null, then return FILTER_ACCEPT.
		if (this.nodeFilter === null) {
			return NodeFilter.FILTER_ACCEPT
		}

		// 5. Set traverser’s active flag.
		this.active = true

		// 6. Let result be the return value of call a user object’s operation with traverser’s filter,
		// "acceptNode", and « node ». If this throws an exception,
		// then unset traverser’s active flag and rethrow the exception.
		try {
			// 8. Return result.
			return this.nodeFilter.acceptNode(node)
		} finally {
			// 7. Unset traverser’s active flag.
			this.active = false
		}
	}
}
