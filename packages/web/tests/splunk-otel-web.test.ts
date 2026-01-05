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

import { SpanAttributes } from '@opentelemetry/api'
import { afterEach, describe, expect, it } from 'vitest'

import SplunkRum from '../src'
import { deinit } from './utils'

describe('SplunkOtelWeb', () => {
	afterEach(() => {
		deinit()
	})

	describe('global attributes', () => {
		it('should be settable via constructor and then readable', () => {
			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				globalAttributes: {
					key1: 'value1',
				},
				rumAccessToken: '<token>',
			})
			const globalAttributes = SplunkRum.getGlobalAttributes()
			expect(globalAttributes).toMatchObject({
				key1: 'value1',
			})
			// Should also include platform attributes
			expect(globalAttributes).toHaveProperty('user_agent.os.name')
			expect(globalAttributes).toHaveProperty('user_agent.language')
			expect(globalAttributes).toHaveProperty('user_agent.original')
		})

		it('should be patchable via setGlobalAttributes and then readable', () => {
			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				globalAttributes: {
					key1: 'value1',
					key2: 'value2',
				},
				rumAccessToken: '<token>',
			})

			SplunkRum.setGlobalAttributes({
				key2: 'value2-changed',
				key3: 'value3',
			})

			const globalAttributes = SplunkRum.getGlobalAttributes()
			expect(globalAttributes).toMatchObject({
				key1: 'value1',
				key2: 'value2-changed',
				key3: 'value3',
			})
			// Should also include platform attributes
			expect(globalAttributes).toHaveProperty('user_agent.os.name')
			expect(globalAttributes).toHaveProperty('user_agent.language')
			expect(globalAttributes).toHaveProperty('user_agent.original')
		})

		it('should notify about changes via setGlobalAttributes', () => {
			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				globalAttributes: {
					key1: 'value1',
					key2: 'value2',
				},
				rumAccessToken: '<token>',
			})

			let receivedAttributes: SpanAttributes | undefined
			SplunkRum.addEventListener('global-attributes-changed', ({ payload }) => {
				receivedAttributes = payload.attributes
			})

			SplunkRum.setGlobalAttributes({
				key2: 'value2-changed',
				key3: 'value3',
			})

			expect(receivedAttributes).toMatchObject({
				key1: 'value1',
				key2: 'value2-changed',
				key3: 'value3',
			})
			// Should also include platform attributes
			expect(receivedAttributes).toHaveProperty('user_agent.os.name')
			expect(receivedAttributes).toHaveProperty('user_agent.language')
			expect(receivedAttributes).toHaveProperty('user_agent.original')
		})
	})

	describe('session ID', () => {
		it('should be readable', () => {
			expect(SplunkRum.getSessionId()).toBe(undefined)

			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
			})
			expect(SplunkRum.getSessionId()).to.match(/[0-9a-f]{32}/)

			SplunkRum.deinit()
			expect(SplunkRum.getSessionId()).toBe(undefined)
		})
	})

	describe('.inited', () => {
		it('should follow lifecycle', () => {
			expect(SplunkRum.inited).toBe(false)

			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
			})
			expect(SplunkRum.inited).toBe(true)

			SplunkRum.deinit()
			expect(SplunkRum.inited).toBe(false)
		})
	})
})
