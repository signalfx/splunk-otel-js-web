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

import { describe, expect, it } from 'vitest'

import { isValidExternalSessionMetadata } from './external-session-metadata'

describe('isValidExternalSessionMetadata', () => {
	it.each([
		{ expected: true, metadata: {}, name: 'omitted' },
		{ expected: true, metadata: { anonymousUserId: undefined }, name: 'undefined' },
		{ expected: true, metadata: { anonymousUserId: 'external-anonymous-id' }, name: 'non-empty string' },
		{ expected: false, metadata: { anonymousUserId: '' }, name: 'empty string' },
		{ expected: false, metadata: { anonymousUserId: null }, name: 'null' },
		{ expected: false, metadata: { anonymousUserId: 123 }, name: 'number' },
		{ expected: false, metadata: { anonymousUserId: false }, name: 'boolean' },
		{ expected: false, metadata: { anonymousUserId: {} }, name: 'object' },
	])('returns $expected for $name anonymousUserId', ({ expected, metadata }) => {
		expect(
			isValidExternalSessionMetadata({
				sessionId: 'external-session-id',
				sessionLastActivity: Date.now(),
				sessionStart: Date.now() - 1000,
				...metadata,
			}),
		).toBe(expected)
	})
})
