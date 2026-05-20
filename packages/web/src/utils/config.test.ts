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

import { normalizeIgnoreUrlsConfig } from './config'

describe('normalizeIgnoreUrlsConfig', () => {
	it('returns undefined for nullish and primitive values', () => {
		// @ts-expect-error No argument on purpose.
		expect(normalizeIgnoreUrlsConfig()).toBeUndefined()
		expect(normalizeIgnoreUrlsConfig(null)).toBeUndefined()
		expect(normalizeIgnoreUrlsConfig('value')).toBeUndefined()
		expect(normalizeIgnoreUrlsConfig(42)).toBeUndefined()
		expect(normalizeIgnoreUrlsConfig(true)).toBeUndefined()
	})

	it('returns undefined for empty objects', () => {
		expect(normalizeIgnoreUrlsConfig({})).toBeUndefined()
	})

	it('converts regex strings recursively for each ignoreUrls key', () => {
		const options: any = {
			ignoreUrls: ['regex/test-top-level/', '/exact-match'],
			instrumentations: {
				frustrationSignals: {
					deadClick: { ignoreUrls: ['regex/dead-click/'] },
					errorClick: { ignoreUrls: ['regex/error-click/'] },
					thrashedCursor: { ignoreUrls: ['regex/thrashed-cursor/'] },
				},
			},
			spaMetrics: {
				ignoreUrls: ['regex/spa-metrics/'],
			},
		}

		expect(normalizeIgnoreUrlsConfig(options)).toBeUndefined()
		expect(options.ignoreUrls[0]).toBeInstanceOf(RegExp)
		expect(options.ignoreUrls[0] instanceof RegExp && options.ignoreUrls[0].test('test-top-level')).toBeTruthy()
		expect(options.ignoreUrls[1]).toBe('/exact-match')
		expect(options.instrumentations.frustrationSignals.deadClick.ignoreUrls[0]).toBeInstanceOf(RegExp)
		expect(options.instrumentations.frustrationSignals.errorClick.ignoreUrls[0]).toBeInstanceOf(RegExp)
		expect(options.instrumentations.frustrationSignals.thrashedCursor.ignoreUrls[0]).toBeInstanceOf(RegExp)
		expect(options.spaMetrics.ignoreUrls[0]).toBeInstanceOf(RegExp)
	})

	it('preserves non-string ignoreUrls entries', () => {
		const regExpEntry = /already-regex/
		const options = {
			ignoreUrls: [regExpEntry, 'regex/new-pattern/', 123, true],
		}

		normalizeIgnoreUrlsConfig(options)

		expect(options.ignoreUrls[0]).toBe(regExpEntry)
		expect(options.ignoreUrls[1]).toBeInstanceOf(RegExp)
		expect(options.ignoreUrls[2]).toBe(123)
		expect(options.ignoreUrls[3]).toBe(true)
	})

	it('keeps invalid regex strings as plain strings', () => {
		const options = {
			ignoreUrls: ['regex/[invalid/', 'regex/abc/z'],
		}

		normalizeIgnoreUrlsConfig(options)

		expect(options.ignoreUrls[0]).toBe('regex/[invalid/')
		expect(options.ignoreUrls[1]).toBe('regex/abc/z')
	})

	it('ignores non-array ignoreUrls values', () => {
		const options = {
			ignoreUrls: 'regex/not-an-array/',
			nested: {
				ignoreUrls: { bad: true },
			},
		}

		normalizeIgnoreUrlsConfig(options)

		expect(options.ignoreUrls).toBe('regex/not-an-array/')
		expect(options.nested.ignoreUrls).toEqual({ bad: true })
	})

	it('normalizes ignoreUrls inside arrays of objects', () => {
		const options: any = {
			groups: [
				{
					ignoreUrls: ['regex/inside-array/'],
				},
			],
		}

		normalizeIgnoreUrlsConfig(options)

		expect(options.groups[0].ignoreUrls[0]).toBeInstanceOf(RegExp)
		expect(
			options.groups[0].ignoreUrls[0] instanceof RegExp && options.groups[0].ignoreUrls[0].test('inside-array'),
		).toBeTruthy()
	})

	it('supports regex flags in regex string values', () => {
		const options: any = {
			ignoreUrls: [String.raw`regex/^api\/v[0-9]+$/i`],
		}

		normalizeIgnoreUrlsConfig(options)

		expect(options.ignoreUrls[0]).toBeInstanceOf(RegExp)
		expect(options.ignoreUrls[0] instanceof RegExp && options.ignoreUrls[0].test('API/v2')).toBeTruthy()
		expect(options.ignoreUrls[0] instanceof RegExp && options.ignoreUrls[0].flags.includes('i')).toBeTruthy()
	})

	it('only transforms values under keys named ignoreUrls', () => {
		const abort = new AbortController()

		const options = {
			foo: abort,
			nested: {
				ignoreUrlPatterns: ['regex/also-unchanged/'],
			},
			notIgnoreUrls: ['regex/leave-me-alone/'],
		}

		normalizeIgnoreUrlsConfig(options)

		expect(options.notIgnoreUrls[0]).toBe('regex/leave-me-alone/')
		expect(options.nested.ignoreUrlPatterns[0]).toBe('regex/also-unchanged/')
		expect(options.foo).toBe(abort)
	})
})
