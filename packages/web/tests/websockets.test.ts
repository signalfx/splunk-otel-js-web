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

import { SpanKind } from '@opentelemetry/api'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SplunkOTLPTraceExporter } from '../src/exporters/otlp'
import { SplunkZipkinExporter } from '../src/exporters/zipkin'
import { deinit, getTracer, initWithDefaultConfig, SpanCapturer } from './utils'

describe('can produce websocket events', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				websocket: true,
			},
		})
	})
	afterEach(() => {
		deinit()
	})

	it('can produce a series of spans from basic usage', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/', 'foo')
		const openListener = function () {
			socket.send('Hello server')
			socket.removeEventListener('open', openListener)
		}

		const msgListener = function () {
			socket.removeEventListener('message', msgListener)
		}

		socket.addEventListener('open', openListener)
		socket.addEventListener('message', msgListener)
		// Handful of misc listener calls to exercise some code while we have a test fixture handy
		socket.addEventListener('message', msgListener) // has no effect
		// eslint-disable-next-line unicorn/consistent-function-scoping
		const listenerReferenceTest = () => {
			/* never actually added */
		}
		socket.removeEventListener('message', listenerReferenceTest)

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		expect(wsSpans).toHaveLength(3)

		wsSpans.forEach((span) => {
			expect(span).toHaveSpanAttribute('http.url', 'ws://127.0.0.1:8979/')
		})
		expect(wsSpans[0].name).toBe('connect')
		expect(wsSpans[0].kind).toBe(SpanKind.CLIENT)
		expect(wsSpans[0]).toHaveSpanAttribute('protocols', 'foo')
		expect(wsSpans[0]).toHaveSpanAttribute('network.protocol.name', 'websocket')
		expect(wsSpans[0]).toHaveSpanAttribute('network.transport', 'tcp')
		expect(wsSpans[0]).toHaveSpanAttribute('server.address', '127.0.0.1')
		expect(wsSpans[0]).toHaveSpanAttribute('server.port', 8979)
		expect(wsSpans[0]).toHaveSpanAttribute('url.scheme', 'ws')
		expect(wsSpans[0]).toHaveSpanAttribute('websocket.connection.id')
		expect(wsSpans[1].name).toBe('send')
		expect(wsSpans[1].kind).toBe(SpanKind.PRODUCER)
		expect(wsSpans[1]).toHaveSpanAttribute('http.request_content_length', 12)
		expect(wsSpans[1]).toHaveSpanAttribute('protocol', 'foo')
		expect(wsSpans[1]).toHaveSpanAttribute('websocket.message.direction', 'send')
		expect(wsSpans[1]).toHaveSpanAttribute('websocket.message.sequence', 1)
		expect(wsSpans[1]).toHaveSpanAttribute('websocket.message.type', 'text')
		expect(wsSpans[2].name).toBe('onmessage')
		expect(wsSpans[2].kind).toBe(SpanKind.CONSUMER)
		expect(wsSpans[2]).toHaveSpanAttribute('http.response_content_length', 8)
		expect(wsSpans[2]).toHaveSpanAttribute('protocol', 'foo')
		expect(wsSpans[2]).toHaveSpanAttribute('websocket.message.direction', 'receive')
		expect(wsSpans[2]).toHaveSpanAttribute('websocket.message.sequence', 2)
		expect(wsSpans[2]).toHaveSpanAttribute('websocket.message.type', 'text')
		expect(wsSpans[1].attributes['websocket.connection.id']).toBe(wsSpans[0].attributes['websocket.connection.id'])
		expect(wsSpans[2].attributes['websocket.connection.id']).toBe(wsSpans[0].attributes['websocket.connection.id'])

		socket.close()
		await new Promise((resolve) => setTimeout(resolve, 100))

		const closeSpan = capturer.spans.find((span) => span.name === 'close')
		expect(closeSpan).toBeDefined()
		expect(closeSpan).toHaveSpanAttribute('websocket.close.code', 1005)
		expect(closeSpan).toHaveSpanAttribute('websocket.close.initiator', 'client')
		expect(closeSpan).toHaveSpanAttribute('websocket.close.was_clean', true)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.received.bytes', 8)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.received.count', 1)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.sent.bytes', 12)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.sent.count', 1)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.spans.dropped', 0)
		expect(closeSpan).toHaveSpanAttribute('websocket.connection.open_duration_ms')
	})

	it('can handle EventListener', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/', ['foo', 'bar'])
		socket.addEventListener('open', () => {
			socket.send('Hello server')
		})
		socket.addEventListener(
			'message',
			{
				handleEvent() {},
			},
			{ once: true },
		)
		socket.addEventListener('message', () => {})

		await new Promise((resolve) => setTimeout(resolve, 1000))
		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		expect(wsSpans).toHaveLength(3)
		expect(wsSpans[0]).toHaveSpanAttribute('protocols', '["foo","bar"]')
		expect(wsSpans[1]).toHaveSpanAttribute('protocol', 'foo')
		socket.close()
	})

	it('uses the receive span as the active context in message listeners', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/')
		socket.addEventListener(
			'message',
			() => {
				getTracer('websocket-test').startSpan('message-handler').end()
				socket.close()
			},
			{ once: true },
		)
		socket.addEventListener(
			'open',
			() => {
				socket.send('Hello server')
			},
			{ once: true },
		)

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const receiveSpan = capturer.spans.find((span) => span.name === 'onmessage')
		const childSpan = capturer.spans.find((span) => span.name === 'message-handler')
		expect(receiveSpan).toBeDefined()
		expect(childSpan?.parentSpanId).toBe(receiveSpan?.spanContext().spanId)
		expect(childSpan?.spanContext().traceId).toBe(receiveSpan?.spanContext().traceId)
	})

	it('uses the receive span as the active context in onmessage listeners', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/')
		const onmessage = () => {
			getTracer('websocket-test').startSpan('onmessage-handler').end()
			socket.close()
		}
		// eslint-disable-next-line unicorn/prefer-add-event-listener
		socket.onmessage = onmessage
		expect(socket.onmessage).toBe(onmessage)
		socket.addEventListener(
			'open',
			() => {
				socket.send('Hello server')
			},
			{ once: true },
		)

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const receiveSpan = capturer.spans.find((span) => span.name === 'onmessage')
		const childSpan = capturer.spans.find((span) => span.name === 'onmessage-handler')
		expect(receiveSpan).toBeDefined()
		expect(childSpan?.parentSpanId).toBe(receiveSpan?.spanContext().spanId)
		expect(childSpan?.spanContext().traceId).toBe(receiveSpan?.spanContext().traceId)
	})

	it('tracks receives before capture listeners that stop propagation', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/')
		const closed = new Promise<void>((resolve) => socket.addEventListener('close', () => resolve(), { once: true }))
		socket.addEventListener(
			'message',
			(event) => {
				getTracer('websocket-test').startSpan('capture-handler').end()
				event.stopImmediatePropagation()
				socket.close()
			},
			{ capture: true, once: true },
		)
		socket.addEventListener('open', () => socket.send('Hello server'), { once: true })

		await closed

		const receiveSpan = capturer.spans.find((span) => span.name === 'onmessage')
		const childSpan = capturer.spans.find((span) => span.name === 'capture-handler')
		const closeSpan = capturer.spans.find((span) => span.name === 'close')
		expect(receiveSpan).toBeDefined()
		expect(childSpan?.parentSpanId).toBe(receiveSpan?.spanContext().spanId)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.received.count', 1)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.received.bytes', 8)
	})

	it('measures text message sizes in UTF-8 bytes', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/')
		const opened = new Promise<void>((resolve) => socket.addEventListener('open', () => resolve(), { once: true }))
		const received = new Promise<void>((resolve) =>
			socket.addEventListener('message', () => resolve(), { once: true }),
		)
		const closed = new Promise<void>((resolve) => socket.addEventListener('close', () => resolve(), { once: true }))

		await opened
		socket.send('é')
		await received
		socket.close()
		await closed

		const sendSpan = capturer.spans.find((span) => span.name === 'send')
		const receiveSpan = capturer.spans.find((span) => span.name === 'onmessage')
		const closeSpan = capturer.spans.find((span) => span.name === 'close')
		expect(sendSpan).toHaveSpanAttribute('websocket.message.size', 2)
		expect(sendSpan).toHaveSpanAttribute('http.request_content_length', 2)
		expect(receiveSpan).toHaveSpanAttribute('websocket.message.size', 2)
		expect(receiveSpan).toHaveSpanAttribute('http.response_content_length', 2)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.sent.bytes', 2)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.received.bytes', 2)
	})

	it('removes query parameters from captured websocket URLs', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/?access_token=secret')

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const connectSpan = capturer.spans.find((span) => span.name === 'connect')
		expect(connectSpan).toHaveSpanAttribute('http.url', 'ws://127.0.0.1:8979/')
		expect(connectSpan?.attributes['http.url']).not.toContain('secret')

		socket.close()
	})

	it('keeps constructor secrets out of both exporters after attribute redaction', async () => {
		const sensitiveUrl = 'ws://[bad]/?access_token=secret'
		expect(() => new WebSocket(sensitiveUrl)).toThrow()

		const connectSpan = capturer.spans.find((span) => span.name === 'connect')
		if (!connectSpan) {
			throw new Error('Expected the failed WebSocket constructor to emit a connect span')
		}

		expect(connectSpan.attributes['error.message']).toBeTruthy()
		expect(connectSpan.status.message).toBeUndefined()
		// Some browsers omit the supplied URL from constructor errors; cover the same redaction path consistently.
		connectSpan.attributes['error.message'] = `Invalid WebSocket URL: ${sensitiveUrl}`

		const redactErrorMessage = (attributes: typeof connectSpan.attributes) => {
			const redactedAttributes = { ...attributes }
			delete redactedAttributes['error.message']
			return redactedAttributes
		}
		let otlpPayload = ''
		let zipkinPayload = ''
		const otlpExporter = new SplunkOTLPTraceExporter({
			onAttributesSerializing: redactErrorMessage,
			url: 'https://example.com/v1/trace',
			xhrSender: (_url, body) => {
				otlpPayload = typeof body === 'string' ? body : new TextDecoder().decode(body)
			},
		})
		const zipkinExporter = new SplunkZipkinExporter({
			onAttributesSerializing: redactErrorMessage,
			url: 'https://example.com/v1/trace',
			xhrSender: (_url, body) => {
				zipkinPayload = typeof body === 'string' ? body : new TextDecoder().decode(body)
			},
		})

		otlpExporter.export([connectSpan], () => {})
		zipkinExporter.export([connectSpan], () => {})

		expect(otlpPayload).not.toBe('')
		expect(zipkinPayload).not.toBe('')
		expect(otlpPayload).not.toContain('secret')
		expect(zipkinPayload).not.toContain('secret')
		await otlpExporter.shutdown()
		await zipkinExporter.shutdown()
	})

	// FIXME find a way to make send throw..

	it('can report failed connect to non-listening port', async () => {
		const socket = new WebSocket('ws://127.0.0.1:31874/', ['foo', 'bar']) // assuming no ws server running there...
		socket.addEventListener('error', () => {})

		await new Promise((resolve) => setTimeout(resolve, 1000))
		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		const connectSpan = wsSpans.find((span) => span.name === 'connect')
		const closeSpan = wsSpans.find((span) => span.name === 'close')

		expect(wsSpans).toHaveLength(2)
		expect(connectSpan).toHaveSpanAttribute('http.url', 'ws://127.0.0.1:31874/')
		expect(connectSpan).toHaveSpanAttribute('component', 'websocket')
		expect(connectSpan).toHaveSpanAttribute('error', true)
		expect(closeSpan).toHaveSpanAttribute('websocket.close.code', 1006)
		expect(closeSpan).toHaveSpanAttribute('websocket.close.initiator', 'server_or_network')
		expect(closeSpan).toHaveSpanAttribute('websocket.close.was_clean', false)

		socket.close()
	})

	it('Websocket keeps static values', () => {
		expect(WebSocket.CONNECTING).toBe(0)
		expect(WebSocket.OPEN).toBe(1)
		expect(WebSocket.CLOSING).toBe(2)
		expect(WebSocket.CLOSED).toBe(3)
	})

	it('caps message spans while retaining aggregate connection health', async () => {
		deinit()
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				websocket: {
					maxMessageSpansPerConnection: 2,
				},
			},
		})

		const socket = new WebSocket('ws://127.0.0.1:8979/')
		let receivedMessages = 0
		socket.addEventListener('open', () => {
			socket.send('first')
			socket.send('second')
		})
		// Exercise the onmessage property: aggregate receive tracking must not depend on wrapping application listeners.
		// eslint-disable-next-line unicorn/prefer-add-event-listener
		socket.onmessage = () => {
			receivedMessages += 1
			if (receivedMessages === 2) {
				socket.close()
			}
		}

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		const messageSpans = wsSpans.filter((span) => span.name === 'send' || span.name === 'onmessage')
		const closeSpan = wsSpans.find((span) => span.name === 'close')

		expect(messageSpans).toHaveLength(2)
		expect(closeSpan).toBeDefined()
		expect(closeSpan).toHaveSpanAttribute('websocket.message.sent.count', 2)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.received.count', 2)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.spans.dropped', 2)
	})

	it('does not reuse a capped receive span for later messages in a burst', async () => {
		deinit()
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				websocket: {
					maxMessageSpansPerConnection: 2,
				},
			},
		})

		const socket = new WebSocket('ws://127.0.0.1:8979/')
		const closed = new Promise<void>((resolve) => socket.addEventListener('close', () => resolve(), { once: true }))
		let receivedMessages = 0
		socket.addEventListener('message', () => {
			getTracer('websocket-test')
				.startSpan(`burst-handler-${receivedMessages + 1}`)
				.end()
			receivedMessages += 1
			if (receivedMessages === 6) {
				socket.close()
			}
		})
		socket.addEventListener('open', () => socket.send('burst'), { once: true })
		const closeTimeout = setTimeout(() => socket.close(), 1000)
		await closed
		clearTimeout(closeTimeout)

		const receiveSpan = capturer.spans.find((span) => span.name === 'onmessage')
		const handlerSpans = capturer.spans.filter((span) => span.name.startsWith('burst-handler-'))
		const closeSpan = capturer.spans.find((span) => span.name === 'close')
		expect(receiveSpan).toBeDefined()
		expect(handlerSpans).toHaveLength(6)
		expect(handlerSpans[0].parentSpanId).toBe(receiveSpan?.spanContext().spanId)
		expect(handlerSpans.slice(1).every((span) => span.parentSpanId !== receiveSpan?.spanContext().spanId)).toBe(
			true,
		)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.received.count', 6)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.spans.dropped', 5)
	})

	it('does not count a send discarded while closing', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/')
		const opened = new Promise<void>((resolve) => socket.addEventListener('open', () => resolve(), { once: true }))
		const closed = new Promise<void>((resolve) => socket.addEventListener('close', () => resolve(), { once: true }))

		await opened
		socket.close()
		expect(socket.readyState).toBe(WebSocket.CLOSING)
		socket.send('discarded')
		await closed

		const closeSpan = capturer.spans.find((span) => span.name === 'close')
		expect(capturer.spans.filter((span) => span.name === 'send')).toHaveLength(0)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.sent.count', 0)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.sent.bytes', 0)
	})

	it('keeps send errors within the configured message span limit', async () => {
		deinit()
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				websocket: {
					maxMessageSpansPerConnection: 0,
				},
			},
		})

		const socket = new WebSocket('ws://127.0.0.1:8979/')
		const opened = new Promise<void>((resolve) => socket.addEventListener('open', () => resolve(), { once: true }))
		const closed = new Promise<void>((resolve) => socket.addEventListener('close', () => resolve(), { once: true }))

		expect(() => socket.send('before open')).toThrow()
		await opened
		socket.close()
		await closed

		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		const closeSpan = wsSpans.find((span) => span.name === 'close')
		expect(wsSpans.filter((span) => span.name === 'send')).toHaveLength(0)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.send.errors', 1)
		expect(closeSpan).toHaveSpanAttribute('websocket.message.spans.dropped', 1)
	})
})
