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

import { context, trace, SpanStatusCode } from '@opentelemetry/api'

import SplunkOtelWeb, { INSTRUMENTATIONS_ALL_DISABLED } from '../src'
import { deinit, SpanCapturer } from './utils'

import { describe, it, expect, beforeEach, afterEach, assert } from 'vitest'

// note: we've added these tests mainly to keep track of substantial changes in the Open Telemetry API
describe('Transitive API', () => {
	let spanCapturer = new SpanCapturer()

	beforeEach(() => {
		spanCapturer = new SpanCapturer()
		SplunkOtelWeb.init({
			applicationName: 'my-app',
			beaconEndpoint: 'https://localhost:9411/api/traces',
			rumAccessToken: 'xxx',
			instrumentations: INSTRUMENTATIONS_ALL_DISABLED,
			spanProcessors: [spanCapturer],
		})
	})

	afterEach(() => {
		deinit()
	})

	describe('Tracer', () => {
		function getTestTracer() {
			const testTracer = SplunkOtelWeb.provider?.getTracer('test')
			assert(testTracer)

			return testTracer
		}

		it('should return a tracer', () => {
			const tracer = getTestTracer()
			expect(typeof tracer.startSpan).toBe('function')
			expect(typeof tracer.getActiveSpanProcessor).toBe('function')
		})

		it('can start a span', () => {
			const span = getTestTracer().startSpan('span.test')

			expect(typeof span.end).toBe('function')
			expect(typeof span.spanContext).toBe('function')
			expect(typeof span.recordException).toBe('function')
			expect(typeof span.setAttributes).toBe('function')
			expect(typeof span.setStatus).toBe('function')

			span.end()
		})
	})

	describe('Span', () => {
		const startTime = new Date(2021, 1, 1, 0, 0, 0, 0)
		function getTestSpan() {
			const testTracer = SplunkOtelWeb.provider?.getTracer('test')
			assert(testTracer)

			return testTracer.startSpan('test.span', { startTime })
		}

		it('can set duration', () => {
			const span = getTestSpan()
			span.end(new Date(2021, 1, 1, 0, 1, 1, 0))

			expect(spanCapturer.spans[0].duration).toStrictEqual([61, 0])
		})

		it('can set attributes', () => {
			const span = getTestSpan()
			span.setAttributes({
				attr1: 'val1',
				attr2: 'val2',
			})
			span.end()

			expect(spanCapturer.spans[0].attributes['attr1']).toBe('val1')
			expect(spanCapturer.spans[0].attributes['attr2']).toBe('val2')
		})

		it('can set status', () => {
			const span = getTestSpan()
			span.setStatus({ code: SpanStatusCode.UNSET })
			span.setStatus({ code: SpanStatusCode.OK })
			span.setStatus({ code: SpanStatusCode.ERROR })
			span.end()

			expect(spanCapturer.spans[0].status.code).toBe(SpanStatusCode.ERROR)
		})

		it('can set record an exception', () => {
			const span = getTestSpan()
			class CustomError extends Error {}
			span.recordException(new CustomError('Exception to be recorded.'))
			span.end()

			expect(spanCapturer.spans[0].status.code).toBe(SpanStatusCode.UNSET)
			expect(spanCapturer.spans[0].events[0].name).toBe('exception')
			expect(spanCapturer.spans[0].events[0]?.attributes?.['exception.type']).toBe('Error')
			expect(spanCapturer.spans[0].events[0]?.attributes?.['exception.message']).toBe('Exception to be recorded.')
		})
	})

	describe('api.context', () => {
		it('can set span as active', () => {
			const tracer = SplunkOtelWeb.provider?.getTracer('test')
			const span = tracer?.startSpan('test-span')

			assert(span)

			context.with(trace.setSpan(context.active(), span), () => {
				expect(trace.getSpan(context.active())).toBe(span)
			})
		})

		it('can create a child of an active span', () => {
			const tracer = SplunkOtelWeb.provider?.getTracer('test')
			const span = tracer?.startSpan('test-span')

			assert(span)
			assert(tracer)

			context.with(trace.setSpan(context.active(), span), () => {
				tracer.startSpan('child-span').end()
			})
			span.end()

			expect(spanCapturer.spans).toHaveLength(2)

			const [childSpan, parentSpan] = spanCapturer.spans
			expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
			expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
		})
	})
})
