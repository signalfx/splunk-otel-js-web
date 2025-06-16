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
import { describe, expect, it } from 'vitest'
import {
	computeSourceMapId,
	computeSourceMapIdFromFile,
	getCodeSnippet,
	getInsertIndexForCodeSnippet,
	getSourceMapUploadUrl,
} from '../src/utils'

describe('getCodeSnippet', function () {
	it('inserts the source map id into the snippet', function () {
		const code = getCodeSnippet('testid123')
		expect(code).contains("window.sourceMapIds[s] = 'testid123'")
	})

	it('does not throw error in a node environment', function () {
		const code = getCodeSnippet('testid123')

		eval(code)
	})

	it('does not throw error when appended to code that does not end with semicolon or new line', function () {
		const code = 'let x = 5' + getCodeSnippet('testid123')

		eval(code)
	})
})

describe('computeSourceMapId', function () {
	it('returns a consistent id in GUID format', function () {
		const id = computeSourceMapId('console.log("Hello world")')

		expect(id).eq('d77ec5d8-4fb5-fbc8-1897-54b54e939bcd')
		expect(id).eq(computeSourceMapId('console.log("Hello world")'))
		expect(id).not.eq(computeSourceMapId('console.log("a different snippet gets a different id");'))
	})
})

describe('computeSourceMapIdFromFilePath', function () {
	it('returns an id in GUID format', async function () {
		const id = await computeSourceMapIdFromFile('package.json')
		expect(id).matches(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)
	})
})

describe('getSourceMapUploadUrl', function () {
	it('uses the proper API based on the realm and id', function () {
		const url = getSourceMapUploadUrl('us0', 'd77ec5d8-4fb5-fbc8-1897-54b54e939bcd')
		expect(url).eq('https://api.us0.signalfx.com/v2/rum-mfm/source-maps/id/d77ec5d8-4fb5-fbc8-1897-54b54e939bcd')
	})
})

describe('getInsertIndexForCodeSnippet', function () {
	it('returns the end of the string when there is no source map comment present', function () {
		const content = 'line1\nline2\nline3'
		expect(getInsertIndexForCodeSnippet(content)).eq(content.length)
	})
	it('returns the index of the source map comment when it is present', function () {
		const content = 'line1\n//# sourceMappingURL=bundle.js.map'
		expect(getInsertIndexForCodeSnippet(content)).eq(5)
	})
	it('returns the index of the source map comment when it occurs at the end of the string, but the string ends in a newline', function () {
		const content = 'line1\n//# sourceMappingURL=bundle.js.map\n'
		expect(getInsertIndexForCodeSnippet(content)).eq(5)
	})
	it('returns the index of the last source map comment, when there are multiple comments present', function () {
		const content = 'line1\n//# sourceMappingURL=bundle.js.map\nline2\n//# sourceMappingURL=bundle.js.map'
		expect(getInsertIndexForCodeSnippet(content)).eq(46)
		expect(getInsertIndexForCodeSnippet(content)).lt(content.length)
	})
	it('returns the end of the string, if there is a lone source map comment in the middle of the content', function () {
		const content = 'line1\n//# sourceMappingURL=bundle.js.map\nline2'
		expect(getInsertIndexForCodeSnippet(content)).eq(content.length)
	})
	it('handles buffer types', function () {
		const content = Buffer.from('line1\n//# sourceMappingURL=bundle.js.map\n')
		expect(getInsertIndexForCodeSnippet(content)).eq(5)
	})
})
