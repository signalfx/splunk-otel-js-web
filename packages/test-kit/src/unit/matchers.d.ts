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
import 'vitest'

interface OtlpSpanMatchers {
	toHaveSpanAttribute: (key: string, expected?: string | number | boolean) => void
	toHaveSpanAttributeContaining: (key: string, substring: string) => void
	toHaveSpanAttributeMatching: (key: string, pattern: RegExp) => void
	toHaveSpanDuration: (expectedMicros: number) => void
	toHaveSpanDurationGreaterThan: (minMicros: number) => void
	toHaveSpanDurationGreaterThanOrEqual: (minMicros: number) => void
	toNotHaveSpanAttribute: (key: string) => void
}

// Module augmentation to register custom matchers with vitest's type system.
// The interfaces must be empty — members are inherited via `extends`.
// See https://vitest.dev/guide/extending-matchers.html
declare module 'vitest' {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface Assertion extends OtlpSpanMatchers {}
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface AsymmetricMatchersContaining extends OtlpSpanMatchers {}
}
