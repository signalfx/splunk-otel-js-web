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

const DOCUMENT_LOAD_RESOURCE_KEY_TTL = 60_000
const documentLoadResourceKeys = new Set<string>()

function getResourceKey(resource: PerformanceResourceTiming): string {
	return [resource.name, resource.initiatorType, resource.fetchStart, resource.responseEnd].join('\n')
}

export function markResourceHandledByDocumentLoad(resource: PerformanceResourceTiming): void {
	const key = getResourceKey(resource)
	documentLoadResourceKeys.add(key)
	window.setTimeout(() => documentLoadResourceKeys.delete(key), DOCUMENT_LOAD_RESOURCE_KEY_TTL)
}

export function wasResourceHandledByDocumentLoad(resource: PerformanceResourceTiming): boolean {
	const key = getResourceKey(resource)
	if (!documentLoadResourceKeys.has(key)) {
		return false
	}

	documentLoadResourceKeys.delete(key)
	return true
}
