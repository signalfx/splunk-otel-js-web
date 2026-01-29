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
// Content of this file is copied from @opentelemetry/sdk-trace-web@1.30.1
// We can remove this file when this issue is resolved: https://github.com/open-telemetry/opentelemetry-js/issues/6323
export function getElementXPath(target: Node, optimised: boolean): string {
	if (target.nodeType === Node.DOCUMENT_NODE) {
		return '/'
	}

	const targetValue = getNodeValue(target as HTMLElement, optimised)
	if (optimised && targetValue.indexOf('@id') > 0) {
		return targetValue
	}

	let xpath = ''
	if (target.parentNode) {
		xpath += getElementXPath(target.parentNode, optimised)
	}

	xpath += targetValue
	return xpath
}

function getNodeValue(target: HTMLElement, optimised: boolean): string {
	const nodeType = target.nodeType
	const index = getNodeIndex(target)
	let nodeValue = ''
	switch (nodeType) {
		case Node.ELEMENT_NODE: {
			const id = target.getAttribute('id')
			if (optimised && id) {
				return `//*[@id="${id}"]`
			}

			nodeValue = target.localName

			break
		}
		case Node.TEXT_NODE:
		case Node.CDATA_SECTION_NODE: {
			nodeValue = 'text()'

			break
		}
		case Node.COMMENT_NODE: {
			nodeValue = 'comment()'

			break
		}
		default: {
			return ''
		}
	}
	// if index is 1 it can be omitted in xpath
	if (nodeValue && index > 1) {
		return `/${nodeValue}[${index}]`
	}

	return `/${nodeValue}`
}

function getNodeIndex(target: HTMLElement) {
	if (!target.parentNode) {
		return 0
	}

	const allowedTypes = [target.nodeType]
	if (target.nodeType === Node.CDATA_SECTION_NODE) {
		allowedTypes.push(Node.TEXT_NODE)
	}

	let elements = Array.from(target.parentNode.childNodes) as HTMLElement[]
	elements = elements.filter((element) => {
		const localName = element.localName
		return allowedTypes.includes(element.nodeType) && localName === target.localName
	})
	if (elements.length > 0) {
		return elements.indexOf(target) + 1 // xpath starts from 1
	}

	// if there are no other similar child xpath doesn't need index
	return 0
}
