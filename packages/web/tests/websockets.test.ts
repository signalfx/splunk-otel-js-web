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

import { deinit, initWithDefaultConfig, SpanCapturer } from './utils'

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

	it('removes query parameters from captured websocket URLs', async () => {
		const socket = new WebSocket('ws://127.0.0.1:8979/?access_token=secret')

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const connectSpan = capturer.spans.find((span) => span.name === 'connect')
		expect(connectSpan).toHaveSpanAttribute('http.url', 'ws://127.0.0.1:8979/')
		expect(connectSpan?.attributes['http.url']).not.toContain('secret')

		socket.close()
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
