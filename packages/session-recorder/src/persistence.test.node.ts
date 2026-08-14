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

import { type FailedReplayPersistence, resolveFailedReplayPersistence, usesIndexedDBPersistence } from './persistence'

describe('failed replay persistence', () => {
	it.each([
		{ configured: undefined, expected: true },
		{ configured: true, expected: true },
		{ configured: 'indexeddb', expected: 'indexeddb' },
		{ configured: 'localstorage', expected: 'localstorage' },
		{ configured: false, expected: false },
	] as Array<{
		configured: FailedReplayPersistence | undefined
		expected: FailedReplayPersistence
	}>)('resolves $configured to $expected', ({ configured, expected }) => {
		expect(resolveFailedReplayPersistence(configured)).toBe(expected)
	})

	it.each([
		{ expected: true, persistence: true },
		{ expected: true, persistence: 'indexeddb' },
		{ expected: false, persistence: 'localstorage' },
		{ expected: false, persistence: false },
	] as Array<{ expected: boolean; persistence: FailedReplayPersistence }>)(
		'uses IndexedDB for $persistence: $expected',
		({ expected, persistence }) => {
			expect(usesIndexedDBPersistence(persistence)).toBe(expected)
		},
	)
})
