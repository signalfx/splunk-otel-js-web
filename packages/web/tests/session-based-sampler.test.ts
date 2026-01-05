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

import { context, SamplingDecision } from '@opentelemetry/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SplunkOtelWebType } from '../src'
import { getGlobal } from '../src/global-utils'
import { SessionBasedSampler } from '../src/session-based-sampler'
import { deinit, initWithDefaultConfig, SpanCapturer } from './utils'

describe('Session based sampler', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('decide sampling based on session id and ratio', () => {
		// Session id < target ratio
		const lowSessionId = '0'.repeat(32)
		const SplunkRum = getGlobal() as SplunkOtelWebType
		if (!SplunkRum.sessionManager) {
			throw new TypeError('Session Manager is not initialized')
		}

		SplunkRum.sessionManager.getSessionId = vi.fn().mockReturnValue(lowSessionId)

		const sampler = new SessionBasedSampler({ ratio: 0.5 })
		expect(
			sampler.shouldSample(context.active(), '0000000000000000', 'test', 0, {}, []).decision,
			'low session id should be recorded',
		).toBe(SamplingDecision.RECORD_AND_SAMPLED)

		// Session id > target ratio
		const highSessionId = '1234567890abcdeffedcba0987654321'
		SplunkRum.sessionManager.getSessionId = vi.fn().mockReturnValue(highSessionId)

		expect(
			sampler.shouldSample(context.active(), '0000000000000000', 'test', 0, {}, []).decision,
			'high session id should not be recorded',
		).toBe(SamplingDecision.NOT_RECORD)
	})
})
