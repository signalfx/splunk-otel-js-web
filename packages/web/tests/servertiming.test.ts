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

import { describe, it, expect } from 'vitest'
import { captureTraceParent, captureTraceParentFromPerformanceEntries } from '../src/servertiming'
import { PerformanceEntries } from '@opentelemetry/sdk-trace-web'
import { createSpan } from './utils'

describe('server timing', () => {
	it('captureTraceParent() - should deal with simple value', () => {
		const span = createSpan('test')

		captureTraceParent('traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01"', span)

		expect(span.attributes['link.traceId']).toBe('000000000000000078499d3266d75d5f')
		expect(span.attributes['link.spanId']).toBe('7e1c10b3c482edbe')
	})

	it('captureTraceParent() - should deal with multiple values', () => {
		const span = createSpan('test')

		captureTraceParent(
			'other;dur=1234, traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01",misc;desc="stuff"',
			span,
		)
		expect(span.attributes['link.traceId']).toBe('000000000000000078499d3266d75d5f')
		expect(span.attributes['link.spanId']).toBe('7e1c10b3c482edbe')
	})

	it('should deal with single quotes', () => {
		const span = createSpan('test')

		captureTraceParent("traceparent;desc='00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01'", span)
		expect(span.attributes['link.traceId']).toBe('000000000000000078499d3266d75d5f')
		expect(span.attributes['link.spanId']).toBe('7e1c10b3c482edbe')
	})

	it('captureTraceParentFromPerformanceEntries() - should handle absence of serverTiming', () => {
		const entries = {}
		const span = createSpan('test')

		captureTraceParentFromPerformanceEntries(entries, span)
		expect(span.attributes['link.traceId']).toBeUndefined()
	})

	it('should deal with multiple entries', () => {
		const entries = {
			serverTiming: [
				{ name: 'nomatch' },
				{ name: 'traceparent', description: '00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01' },
			],
		}
		const span = createSpan('test')

		captureTraceParentFromPerformanceEntries(entries as PerformanceEntries, span)
		expect(span.attributes['link.traceId']).toBe('000000000000000078499d3266d75d5f')
		expect(span.attributes['link.spanId']).toBe('7e1c10b3c482edbe')
	})
})
