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

import * as assert from 'assert'
import { InternalEventTarget } from '../src/EventTarget'
import { SessionBasedSampler } from '../src/SessionBasedSampler'
import { initSessionTracking, updateSessionStatus } from '../src/session/session'
import { context, SamplingDecision } from '@opentelemetry/api'
import { SplunkWebTracerProvider } from '../src'
import { SESSION_INACTIVITY_TIMEOUT_MS, SESSION_STORAGE_KEY } from '../src/session/constants'

describe('Session based sampler', () => {
	it('decide sampling based on session id and ratio', () => {
		// Session id < target ratio
		const lowSessionId = '0'.repeat(32)
		const lowCookieValue = encodeURIComponent(
			JSON.stringify({
				id: lowSessionId,
				startTime: new Date().getTime(),
				expiresAt: new Date().getTime() + SESSION_INACTIVITY_TIMEOUT_MS,
			}),
		)
		document.cookie = SESSION_STORAGE_KEY + '=' + lowCookieValue + '; path=/; max-age=' + 10
		const provider = new SplunkWebTracerProvider()
		initSessionTracking(provider, lowSessionId, new InternalEventTarget())

		const sampler = new SessionBasedSampler({ ratio: 0.5 })
		assert.strictEqual(
			sampler.shouldSample(context.active(), '0000000000000000', 'test', 0, {}, []).decision,
			SamplingDecision.RECORD_AND_SAMPLED,
			'low session id should be recorded',
		)

		// Session id > target ratio
		const highSessionId = '1234567890abcdeffedcba0987654321'
		const highCookieValue = encodeURIComponent(
			JSON.stringify({
				id: highSessionId,
				startTime: new Date().getTime(),
				expiresAt: new Date().getTime() + SESSION_INACTIVITY_TIMEOUT_MS,
			}),
		)
		document.cookie = SESSION_STORAGE_KEY + '=' + highCookieValue + '; path=/; max-age=' + 10
		updateSessionStatus({
			forceStore: true,
			useLocalStorage: false,
		})

		assert.strictEqual(
			sampler.shouldSample(context.active(), '0000000000000000', 'test', 0, {}, []).decision,
			SamplingDecision.NOT_RECORD,
			'high session id should not be recorded',
		)
	})
})
