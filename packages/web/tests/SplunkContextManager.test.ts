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

import { context, trace } from '@opentelemetry/api'
import SplunkOtelWeb, { INSTRUMENTATIONS_ALL_DISABLED } from '../src'
import { deinit, SpanCapturer } from './utils'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('async context propagation', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		SplunkOtelWeb.init({
			applicationName: 'my-app',
			beaconEndpoint: 'https://localhost:9411/api/traces',
			rumAccessToken: 'xxx',
			context: {
				async: true,
			},
			instrumentations: INSTRUMENTATIONS_ALL_DISABLED,
			spanProcessors: [capturer],
		})
	})

	afterEach(() => {
		deinit()
		capturer.clear()
	})

	it('setTimeout', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')

		await new Promise<void>((resolve) => {
			context.with(trace.setSpan(context.active(), span), () => {
				setTimeout(() => {
					tracer.startSpan('child-span').end()
					span.end()

					resolve()
				})
			})
		})

		expect(capturer.spans).toHaveLength(2)
		const [childSpan, parentSpan] = capturer.spans
		expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
		expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
	})

	it('Promise.then', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')
		await new Promise<void>((resolve) => {
			context.with(trace.setSpan(context.active(), span), () => {
				void Promise.resolve().then(() => {
					tracer.startSpan('child-span').end()
					span.end()

					expect(capturer.spans).toHaveLength(2)
					const [childSpan, parentSpan] = capturer.spans
					expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
					expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
					resolve()
				})
			})
		})
	})

	it('Promise.then - catch', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')

		await new Promise<void>((resolve) => {
			context.with(trace.setSpan(context.active(), span), () => {
				Promise.reject(new Error()).then(
					() => null,
					() => {
						tracer.startSpan('child-span').end()
						span.end()

						resolve()
					},
				)
			})
		})

		expect(capturer.spans).toHaveLength(2)
		const [childSpan, parentSpan] = capturer.spans
		expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
		expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
	})

	it('Promise.catch', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')

		await new Promise<void>((resolve) => {
			context.with(trace.setSpan(context.active(), span), () => {
				Promise.reject(new Error()).catch(() => {
					tracer.startSpan('child-span').end()
					span.end()

					resolve()
				})
			})
		})

		expect(capturer.spans).toHaveLength(2)
		const [childSpan, parentSpan] = capturer.spans
		expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
		expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
	})

	it('mutation observer on chardata', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')

		let isCallbackCalled = false
		const observer = new MutationObserver(function () {
			tracer.startSpan('child-span').end()
			span.end()
			isCallbackCalled = true
		})

		let counter = 1
		const textNode = document.createTextNode(String(counter))
		observer.observe(textNode, {
			characterData: true,
		})

		context.with(trace.setSpan(context.active(), span), () => {
			counter += 1
			textNode.data = String(counter)
		})

		await expect.poll(() => isCallbackCalled).toBeTruthy()

		expect(capturer.spans).toHaveLength(2)
		const [childSpan, parentSpan] = capturer.spans
		expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
		expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
	})

	it('xhr event', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')

		await new Promise<void>((resolve) => {
			context.with(trace.setSpan(context.active(), span), () => {
				const req = new XMLHttpRequest()
				req.open('GET', location.href)
				req.send()

				req.addEventListener('load', () => {
					tracer.startSpan('child-span').end()
					span.end()

					resolve()
				})
			})
		})

		expect(capturer.spans).toHaveLength(2)
		const [childSpan, parentSpan] = capturer.spans
		expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
		expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
	})

	it('xhr onevent', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')

		await new Promise<void>((resolve) => {
			context.with(trace.setSpan(context.active(), span), () => {
				const req = new XMLHttpRequest()
				req.open('GET', location.href)
				req.send()

				req.onload = () => {
					tracer.startSpan('child-span').end()
					span.end()

					resolve()
				}
			})
		})

		expect(capturer.spans).toHaveLength(2)
		const [childSpan, parentSpan] = capturer.spans
		expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
		expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
	})

	it('MessagePort', async () => {
		const tracer = SplunkOtelWeb.provider.getTracer('test')
		const span = tracer.startSpan('test-span')

		const channel = new MessageChannel()
		await new Promise<void>((resolve) => {
			channel.port1.onmessage = function () {
				tracer.startSpan('child-span').end()
				span.end()

				resolve()
			}

			context.with(trace.setSpan(context.active(), span), () => {
				channel.port2.postMessage(null)
			})
		})

		expect(capturer.spans).toHaveLength(2)
		const [childSpan, parentSpan] = capturer.spans
		expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
		expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
	})
})
