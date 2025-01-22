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

import { createHash } from 'crypto'

/**
 * Returns a standardized GUID value to use for a sourceMapId.
 *
 * @param content the source map file contents, or an already-computed hash of the source map (or its source files)
 */
export function computeSourceMapId(content: string): string {
	const sha256 = createHash('sha256').update(content, 'utf-8').digest('hex')
	const guid = [
		sha256.slice(0, 8),
		sha256.slice(8, 12),
		sha256.slice(12, 16),
		sha256.slice(16, 20),
		sha256.slice(20, 32),
	].join('-')
	return guid
}

const SNIPPET_TEMPLATE = `;if (typeof window === 'object') { window.sourceMapIds = window.sourceMapIds || {}; let s = ''; try { throw new Error(); } catch (e) { s = (e.stack.match(/https?:\\/\\/[^\\s]+?(?::\\d+)?(?=:[\\d]+:[\\d]+)/) || [])[0]; } if (s) {window.sourceMapIds[s] = '__SOURCE_MAP_ID_PLACEHOLDER__';}};\n`

export function getCodeSnippet(sourceMapId: string): string {
	return SNIPPET_TEMPLATE.replace('__SOURCE_MAP_ID_PLACEHOLDER__', sourceMapId)
}
