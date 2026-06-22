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
import { hrTimeToMicroseconds } from '@opentelemetry/core'
import { afterEach, expect } from 'vitest'

import type { ExportedTestSpan } from '../common/otel/test-span'

expect.extend({
	toHaveSpanAttribute(received: ExportedTestSpan, key: string, expected?: string | number | boolean) {
		const actual = received.attributes[key]

		if (expected === undefined) {
			return {
				message: () => `expected span "${received.name}" to have attribute "${key}"`,
				pass: actual !== undefined,
			}
		}

		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" attribute "${key}" not to be ${JSON.stringify(expected)}`
					: `expected span "${received.name}" attribute "${key}" to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
			pass: actual === expected,
		}
	},

	toHaveSpanAttributeContaining(received: ExportedTestSpan, key: string, substring: string) {
		const actual = received.attributes[key]
		const pass = actual !== undefined && String(actual).includes(substring)
		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" attribute "${key}" not to contain "${substring}"`
					: `expected span "${received.name}" attribute "${key}" to contain "${substring}", got ${JSON.stringify(actual)}`,
			pass,
		}
	},

	toHaveSpanAttributeMatching(received: ExportedTestSpan, key: string, pattern: RegExp) {
		const actual = received.attributes[key]
		const pass = actual !== undefined && pattern.test(String(actual))
		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" attribute "${key}" not to match ${pattern}`
					: `expected span "${received.name}" attribute "${key}" to match ${pattern}, got ${JSON.stringify(actual)}`,
			pass,
		}
	},

	toHaveSpanDuration(received: ExportedTestSpan, expectedMicros: number) {
		const actual = hrTimeToMicroseconds(received.duration)
		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" duration not to be ${expectedMicros}μs`
					: `expected span "${received.name}" duration to be ${expectedMicros}μs, got ${actual}μs`,
			pass: actual === expectedMicros,
		}
	},

	toHaveSpanDurationGreaterThan(received: ExportedTestSpan, minMicros: number) {
		const actual = hrTimeToMicroseconds(received.duration)
		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" duration not to be > ${minMicros}μs, got ${actual}μs`
					: `expected span "${received.name}" duration to be > ${minMicros}μs, got ${actual}μs`,
			pass: actual > minMicros,
		}
	},

	toHaveSpanDurationGreaterThanOrEqual(received: ExportedTestSpan, minMicros: number) {
		const actual = hrTimeToMicroseconds(received.duration)
		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" duration not to be >= ${minMicros}μs, got ${actual}μs`
					: `expected span "${received.name}" duration to be >= ${minMicros}μs, got ${actual}μs`,
			pass: actual >= minMicros,
		}
	},

	toNotHaveSpanAttribute(received: ExportedTestSpan, key: string) {
		const actual = received.attributes[key]
		return {
			message: () =>
				`expected span "${received.name}" not to have attribute "${key}", got ${JSON.stringify(actual)}`,
			pass: actual === undefined,
		}
	},
})

afterEach(() => {
	delete localStorage['_splunk_rum_sid']
	delete localStorage['_splunk_rum_user_anonymousId']
	document.cookie = '_splunk_rum_sid=;expires=Thu, 01 Jan 1970 00:00:00 GMT'
	document.cookie = '_splunk_rum_user_anonymousId=;expires=Thu, 01 Jan 1970 00:00:00 GMT'
})
