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
const REGEX_STRING_PATTERN = /^regex\/([\s\S]*)\/([dgimsuvy]*)$/

function parseRegexString(value: string): RegExp | null {
	const match = REGEX_STRING_PATTERN.exec(value)
	if (!match) {
		return null
	}

	const [, pattern, flags] = match

	try {
		return new RegExp(pattern, flags)
	} catch {
		return null
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === '[object Object]'
}

export function normalizeIgnoreUrlsConfig<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeIgnoreUrlsConfig(entry)) as T
	}

	if (!isPlainObject(value)) {
		return value
	}

	const normalized: Record<string, unknown> = {}

	for (const [key, nestedValue] of Object.entries(value)) {
		if (key === 'ignoreUrls' && Array.isArray(nestedValue)) {
			normalized[key] = nestedValue.map((entry) => {
				if (typeof entry !== 'string') {
					return entry
				}

				return parseRegexString(entry) ?? entry
			})
			continue
		}

		normalized[key] = normalizeIgnoreUrlsConfig(nestedValue)
	}

	return normalized as T
}
