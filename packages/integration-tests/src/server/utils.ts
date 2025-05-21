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
// dummy function that just takes template literals and return them back without any modification
// the reason behind this is to imitate behaviour of css/html in js so the IDE properly highlights syntax
const dummyTemplate = (strings: TemplateStringsArray, ...keys: string[]): string => {
	const result = [strings[0]]
	keys.forEach(function (key, i) {
		result.push(key, strings[i + 1])
	})
	return result.join('')
}

export const css = dummyTemplate
export const html = dummyTemplate
