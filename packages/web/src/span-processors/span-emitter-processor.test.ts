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

import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { describe, expect, it, vi } from 'vitest'

import { SpanEmitterProcessor } from './span-emitter-processor'

function createSpan(component: string): ReadableSpan {
	return {
		attributes: { component },
		spanContext: () => ({
			spanId: '0000000000000001',
			traceFlags: 1,
			traceId: '00000000000000000000000000000001',
		}),
	} as unknown as ReadableSpan
}

describe('SpanEmitterProcessor', () => {
	it('emits start events with component:start event names', () => {
		const processor = new SpanEmitterProcessor()
		const startListener = vi.fn()
		const endListener = vi.fn()

		processor.addEventListener('fetch:start', startListener)
		processor.addEventListener('fetch:end', endListener)

		processor.emitSpan(createSpan('fetch'), 'start')

		expect(startListener).toHaveBeenCalledOnce()
		expect(endListener).not.toHaveBeenCalled()
	})

	it('emits component:end event names for ended spans', () => {
		const processor = new SpanEmitterProcessor()
		const namedEndListener = vi.fn()

		processor.addEventListener('fetch:end', namedEndListener)

		processor.emitSpan(createSpan('fetch'), 'end')

		expect(namedEndListener).toHaveBeenCalledOnce()
	})
})
