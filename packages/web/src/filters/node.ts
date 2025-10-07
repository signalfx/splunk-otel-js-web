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
import {
	isCommentNode,
	isLinkElement,
	isMetaElement,
	isScriptOrNoScriptElement,
	isStyleElement,
	isTextNode,
} from '../types/type-guards/index'
import { isBlobUrl, isExtensionUrl } from '../utils/index'

export const isAllWhitespaceTextNode = (textNode: Node) => {
	// textContent is null only for document and doctype nodes. We pass textNodes to this function but to be sure
	// and for typescript completeness we have this check here.
	if (textNode.textContent === null) {
		return false
	}

	return !/[^\t\n\r ]/.test(textNode.textContent)
}

export const isNodeNotRecorded = (node: Node) => {
	// don't record comments
	if (isCommentNode(node)) {
		return true
	}

	if (isScriptOrNoScriptElement(node)) {
		return true
	}

	// We decided to not process whitespaces nodes as these nodes are largely ignored by HTML.
	// The only case when they are respected is in inline elements
	// (section #spaces_in_between_inline_and_inline-block_elements in included article) which is
	// very edge case, and we accept the drawback caused by this change.
	// Actually we skip only ws nodes that are first or last child of element. It should not break inline styles.
	// See more at:
	// 	https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
	//	https://smartlook-workspace.slack.com/archives/C02E4E8U70A/p1647979337321699
	if (
		isTextNode(node) &&
		(node.previousSibling === null || node.nextSibling === null) &&
		isAllWhitespaceTextNode(node)
	) {
		return true
	}

	// We are not interested in preloaded links, i.e. scripts, images and stylesheets, and manifests.
	// We already apply preload for all stylesheets found on the page. If image is preloaded we simply ignore it
	// at the moment even though it might not be correct.
	// It is a decision made as we do not need to apply assets proxy to these links.
	// <link rel="preload/prefetch" as="script" href="https://.../bundle.js"></link>
	if (
		isLinkElement(node) &&
		['manifest', 'preload', 'prefetch', 'modulepreload'].includes(node.getAttribute('rel') ?? '')
	) {
		return true
	}

	if (isMetaElement(node)) {
		// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv
		if (['content-security-policy', 'refresh'].includes((node.getAttribute('http-equiv') ?? '').toLowerCase())) {
			return true
		}

		// these elements are not useful as they just contain some verification tokens which do not have effect on
		// website look.
		if (
			['facebook-domain-verification', 'apple-itunes-app', 'google-site-verification'].includes(
				(node.getAttribute('name') ?? '').toLowerCase(),
			)
		) {
			return true
		}
	}

	if (isLinkElement(node)) {
		if (isExtensionUrl(node.href) || (isBlobUrl(node.href) && node.rel !== 'stylesheet')) {
			return true
		}
	}

	return false
}

export const shouldSkipProcessingChildren = (node: Node) => {
	if (isStyleElement(node)) {
		return true
	}

	if (isScriptOrNoScriptElement(node)) {
		return true
	}

	return false
}
