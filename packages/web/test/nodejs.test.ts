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

import 'mocha'
import SplunkRum from '../src/index'

describe('Node.js basic support', () => {
	it('Can call init', () => {
		SplunkRum.init({
			allowBots: true,
			applicationName: 'test-app',
			beaconEndpoint: 'https://localhost/events',
			rumAccessToken: 'example1234',
		})
	})

	it('Can call setGlobalAttributes', () => {
		SplunkRum.setGlobalAttributes({ asd: 'asd' })
	})

	it('Can call error', () => {
		SplunkRum.error(new Error('Test error'))
	})

	it('Can call getSessionId()', () => {
		SplunkRum.getSessionId()
	})
})
