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
import { expect } from '@playwright/test'
import type { ExportedTestSpan } from '@test-utils/test-span.js'

// See https://playwright.dev/docs/test-assertions#add-custom-matchers-using-expectextend
expect.extend({
	toHaveSpanAttribute(received: ExportedTestSpan, key: string, expectedValue?: string | number | boolean) {
		const actual = received.attributes[key]

		if (expectedValue === undefined) {
			return {
				message: () => `expected span "${received.name}" to have attribute "${key}"`,
				pass: actual !== undefined,
			}
		}

		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" attribute "${key}" not to be ${JSON.stringify(expectedValue)}`
					: `expected span "${received.name}" attribute "${key}" to be ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`,
			pass: actual === expectedValue,
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

	toHaveSpanAttributeEndingWith(received: ExportedTestSpan, key: string, suffix: string) {
		const actual = received.attributes[key]
		const pass = actual !== undefined && String(actual).endsWith(suffix)
		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" attribute "${key}" not to end with "${suffix}"`
					: `expected span "${received.name}" attribute "${key}" to end with "${suffix}", got ${JSON.stringify(actual)}`,
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

	toHaveSpanAttributeStartingWith(received: ExportedTestSpan, key: string, prefix: string) {
		const actual = received.attributes[key]
		const pass = actual !== undefined && String(actual).startsWith(prefix)
		return {
			message: () =>
				this.isNot
					? `expected span "${received.name}" attribute "${key}" not to start with "${prefix}"`
					: `expected span "${received.name}" attribute "${key}" to start with "${prefix}", got ${JSON.stringify(actual)}`,
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

export interface SpanMatchers {
	toHaveSpanAttribute: (key: string, expectedValue?: string | number | boolean) => void
	toHaveSpanAttributeContaining: (key: string, substring: string) => void
	toHaveSpanAttributeEndingWith: (key: string, suffix: string) => void
	toHaveSpanAttributeMatching: (key: string, pattern: RegExp) => void
	toHaveSpanAttributeStartingWith: (key: string, prefix: string) => void
	toHaveSpanDuration: (expectedMicros: number) => void
	toHaveSpanDurationGreaterThan: (minMicros: number) => void
	toHaveSpanDurationGreaterThanOrEqual: (minMicros: number) => void
	toNotHaveSpanAttribute: (key: string) => void
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	export namespace PlaywrightTest {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
		export interface Matchers<R, T = unknown> extends SpanMatchers {}
	}
}
