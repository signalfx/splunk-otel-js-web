/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { SpanAttributes } from '@opentelemetry/api'
import { expect } from 'chai'
import SplunkRum from '../src'

describe('SplunkOtelWeb', () => {
	afterEach(() => {
		SplunkRum.deinit()
	})

	describe('global attributes', () => {
		it('should be settable via constructor and then readable', () => {
			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
				globalAttributes: {
					key1: 'value1',
				},
			})
			expect(SplunkRum.getGlobalAttributes()).to.deep.eq({
				key1: 'value1',
			})
		})

		it('should be patchable via setGlobalAttributes and then readable', () => {
			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
				globalAttributes: {
					key1: 'value1',
					key2: 'value2',
				},
			})

			SplunkRum.setGlobalAttributes({
				key2: 'value2-changed',
				key3: 'value3',
			})

			expect(SplunkRum.getGlobalAttributes()).to.deep.eq({
				key1: 'value1',
				key2: 'value2-changed',
				key3: 'value3',
			})
		})

		it('should notify about changes via setGlobalAttributes', async () => {
			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
				globalAttributes: {
					key1: 'value1',
					key2: 'value2',
				},
			})

			let receivedAttributes: SpanAttributes | undefined
			SplunkRum.addEventListener('global-attributes-changed', ({ payload }) => {
				receivedAttributes = payload.attributes
			})

			SplunkRum.setGlobalAttributes({
				key2: 'value2-changed',
				key3: 'value3',
			})

			// Wait for promise chain to resolve
			await Promise.resolve()

			expect(receivedAttributes).to.deep.eq({
				key1: 'value1',
				key2: 'value2-changed',
				key3: 'value3',
			})
		})
	})

	describe('session ID', () => {
		it('should be readable', () => {
			expect(SplunkRum.getSessionId()).to.eq(undefined)

			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
			})
			expect(SplunkRum.getSessionId()).to.match(/[0-9a-f]{32}/)

			SplunkRum.deinit()
			expect(SplunkRum.getSessionId()).to.eq(undefined)
		})

		it('should produce notifications when updated', async () => {
			let sessionId: string | undefined

			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
			})
			SplunkRum.addEventListener('session-changed', (ev) => {
				sessionId = ev.payload.sessionId
			})

			document.body.click()
			// TODO: updateSessionStatus()

			// Wait for promise chain to resolve
			await Promise.resolve()

			expect(sessionId).to.match(/[0-9a-f]{32}/)
		})
	})

	describe('.inited', () => {
		it('should follow lifecycle', () => {
			expect(SplunkRum.inited).to.eq(false, 'Should be false in the beginning.')

			SplunkRum.init({
				applicationName: 'app-name',
				beaconEndpoint: 'https://beacon',
				rumAccessToken: '<token>',
			})
			expect(SplunkRum.inited).to.eq(true, 'Should be true after creating.')

			SplunkRum.deinit()
			expect(SplunkRum.inited).to.eq(false, 'Should be false after destroying.')
		})
	})
})
