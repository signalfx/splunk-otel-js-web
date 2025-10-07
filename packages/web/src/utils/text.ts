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
import { traverseDFS } from './traverse'

export const MAX_CLICK_TEXT_LENGTH = 128

export const trimClickText = (text: string) => {
	if (text.length > MAX_CLICK_TEXT_LENGTH) {
		return `${text.slice(0, MAX_CLICK_TEXT_LENGTH - 3)}...`
	}

	return text
}

export const getTextFromNode = (nodeToGetTextFrom: Node, shouldProcessNode: (node: Node) => boolean): string => {
	let text = ''
	for (const node of traverseDFS(nodeToGetTextFrom, { shouldProcessNode })) {
		if (node.nodeValue) {
			text += node.nodeValue
		}

		if (text.length > MAX_CLICK_TEXT_LENGTH) {
			break
		}
	}

	if (text.length > MAX_CLICK_TEXT_LENGTH) {
		text = trimClickText(text)
	}

	return text.replaceAll(/\s\s+/g, ' ').trim()
}
