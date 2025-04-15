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
import { createReadStream } from 'fs'

export const PLUGIN_NAME = 'SplunkRumPlugin'

export const JS_FILE_REGEX = /\.(js|cjs|mjs)$/

function shaToSourceMapId(sha: string) {
	return [sha.slice(0, 8), sha.slice(8, 12), sha.slice(12, 16), sha.slice(16, 20), sha.slice(20, 32)].join('-')
}

/**
 * Returns a standardized GUID value to use for a sourceMapId.
 *
 * @param content the source map file contents, or an already-computed hash of the source map (or its source files)
 */
export function computeSourceMapId(content: string | Buffer<ArrayBufferLike>): string {
	const sha256 = createHash('sha256').update(content).digest('hex')
	return shaToSourceMapId(sha256)
}

export async function computeSourceMapIdFromFile(sourceMapFilePath: string): Promise<string> {
	const hash = createHash('sha256').setEncoding('hex')

	const fileStream = createReadStream(sourceMapFilePath)
	for await (const chunk of fileStream) {
		hash.update(chunk)
	}

	const sha = hash.digest('hex')
	return shaToSourceMapId(sha)
}

const SNIPPET_TEMPLATE = `;if (typeof window === 'object') { window.sourceMapIds = window.sourceMapIds || {}; let s = ''; try { throw new Error(); } catch (e) { s = (e.stack.match(/https?:\\/\\/[^\\s]+?(?::\\d+)?(?=:[\\d]+:[\\d]+)/) || [])[0]; } if (s) {window.sourceMapIds[s] = '__SOURCE_MAP_ID_PLACEHOLDER__';}};`

export function getCodeSnippet(sourceMapId: string): string {
	return SNIPPET_TEMPLATE.replace('__SOURCE_MAP_ID_PLACEHOLDER__', sourceMapId)
}

export function getInsertIndexForCodeSnippet(content: string | Buffer<ArrayBufferLike>): number {
	const SOURCE_MAPPING_URL_COMMENT_START = '//# sourceMappingURL='
	const contentString = typeof content === 'string' ? content : content.toString()
	const sourceMappingUrlIndex = contentString.search(new RegExp('\n' + SOURCE_MAPPING_URL_COMMENT_START + '.*\n?$'))

	if (sourceMappingUrlIndex !== -1) {
		// insert the code snippet above the //# sourceMappingURL comment
		return sourceMappingUrlIndex
	} else {
		// concat the code snippet to the end
		return content.length
	}
}

export function getSourceMapUploadUrl(realm: string, idPathParam: string): string {
	const API_BASE_URL = process.env.O11Y_API_BASE_URL || `https://api.${realm}.signalfx.com`
	return `${API_BASE_URL}/v2/rum-mfm/source-maps/id/${idPathParam}`
}
