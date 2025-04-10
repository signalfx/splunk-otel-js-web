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

import SplunkRum from '../src'
import { SYNTHETICS_RUN_ID_ATTRIBUTE } from '../src/synthetics'
import { deinit, initWithSyncPipeline } from './utils'
import { expect, it, describe } from 'vitest'

describe('synthetics integration', () => {
	it('uses window', async () => {
		window.syntheticsRunId = '1234abcd'.repeat(4)
		const { getFinishedSpans, forceFlush } = initWithSyncPipeline()

		SplunkRum.provider?.getTracer('test-tracer').startSpan('test-span').end()
		await forceFlush()

		const spans = getFinishedSpans()
		expect(spans.length).toBe(1)
		expect(spans[0].tags[SYNTHETICS_RUN_ID_ATTRIBUTE]).toBe('1234abcd'.repeat(4))
		deinit()

		delete window.syntheticsRunId
	})

	it('does not set a tag unless synthetics is active', async () => {
		const { getFinishedSpans, forceFlush } = initWithSyncPipeline()

		SplunkRum.provider?.getTracer('test-tracer').startSpan('test-span').end()
		await forceFlush()

		const spans = getFinishedSpans()
		expect(spans.length).toBe(1)
		expect(spans[0].tags[SYNTHETICS_RUN_ID_ATTRIBUTE]).toBeUndefined()
		deinit()
	})
})
