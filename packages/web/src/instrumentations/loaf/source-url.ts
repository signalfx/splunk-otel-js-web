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

export function normalizeLoafSourceUrl(sourceUrl: string): string {
	if (!sourceUrl || sourceUrl.startsWith('<') || /\s/.test(sourceUrl)) {
		return sourceUrl
	}

	try {
		const url = new URL(sourceUrl, location.origin)
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return sourceUrl
		}

		url.search = ''
		url.hash = ''
		return url.href
	} catch {
		return sourceUrl
	}
}

export function normalizeLoafInvoker(invoker: string): string {
	if (!isHttpUrlLike(invoker)) {
		return invoker
	}

	return normalizeLoafSourceUrl(invoker)
}

function isHttpUrlLike(value: string): boolean {
	return (
		/^(?:https?:)?\/\//i.test(value) ||
		value.startsWith('/') ||
		value.startsWith('./') ||
		value.startsWith('../') ||
		/^[^:/?#]+\.[^/\\?#]+(?:[/?#]|$)/.test(value)
	)
}
