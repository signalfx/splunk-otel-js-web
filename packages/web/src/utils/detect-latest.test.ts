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

import { afterEach, describe, expect, it } from 'vitest'

import { isAgentLoadedViaLockedVersionTag, isAgentLoadedViaNextTag } from './detect-latest'

const COMMIT_HASH = 'a9c4edd78115772b67a6aa464655048f881d9f2b'
const originalCurrentScriptDescriptor = Object.getOwnPropertyDescriptor(document, 'currentScript')

const resetCurrentScript = () => {
	if (originalCurrentScriptDescriptor) {
		Object.defineProperty(document, 'currentScript', originalCurrentScriptDescriptor)
		return
	}

	Reflect.deleteProperty(document, 'currentScript')
}

const setCurrentScriptSrc = (src: string) => {
	const script = document.createElement('script')
	script.src = src
	Object.defineProperty(document, 'currentScript', {
		configurable: true,
		value: script,
	})
}

afterEach(() => {
	resetCurrentScript()
})

describe('isO11yGdiRumLockedVersionUrl', () => {
	it.each([
		`https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3.0.0-${COMMIT_HASH}/splunk-otel-web.js`,
		`https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3.0.0-${COMMIT_HASH}/splunk-otel-web-session-recorder.js`,
	])('detects locked version URL %s', (url) => {
		setCurrentScriptSrc(url)

		expect(isAgentLoadedViaLockedVersionTag()).toBe(true)
	})

	it.each([
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/3/splunk-otel-web.js',
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/latest/splunk-otel-web.js',
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/next/splunk-otel-web.js',
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3.0.0/splunk-otel-web.js',
		`https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3.0.0-${COMMIT_HASH.slice(0, 39)}/splunk-otel-web.js`,
	])('ignores non-locked version URL %s', (url) => {
		setCurrentScriptSrc(url)

		expect(isAgentLoadedViaLockedVersionTag()).toBe(false)
	})
})

describe('isAgentLoadedViaNextTag', () => {
	it.each([
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/next/splunk-otel-web.js',
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/NEXT/splunk-otel-web.js',
	])('detects next URL %s', (url) => {
		setCurrentScriptSrc(url)

		expect(isAgentLoadedViaNextTag()).toBe(true)
	})

	it.each([
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/3/splunk-otel-web.js',
		'https://cdn.observability.splunkcloud.com/o11y-gdi-rum/latest/splunk-otel-web.js',
		`https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3.0.0-${COMMIT_HASH}/splunk-otel-web.js`,
	])('ignores non-next URL %s', (url) => {
		setCurrentScriptSrc(url)

		expect(isAgentLoadedViaNextTag()).toBe(false)
	})
})
