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

import { deinit, initWithDefaultConfig, SpanCapturer } from './utils'
import { SpanKind } from '@opentelemetry/api'
import { expect, it, describe, beforeEach, afterEach } from 'vitest'

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
		socket.removeEventListener('message', function () {
			/* never actually added */
		})

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		expect(wsSpans).toHaveLength(3)

		wsSpans.forEach((span) => {
			expect('ws://127.0.0.1:8979/').toBe(span.attributes['http.url'])
		})
		expect(wsSpans[0].name).toBe('connect')
		expect(wsSpans[0].kind).toBe(SpanKind.CLIENT)
		expect(wsSpans[0].attributes.protocols).toBe('foo')
		expect(wsSpans[1].name).toBe('send')
		expect(wsSpans[1].kind).toBe(SpanKind.PRODUCER)
		expect(wsSpans[1].attributes['http.request_content_length']).toBe(12)
		expect(wsSpans[1].attributes.protocol).toBe('foo')
		expect(wsSpans[2].name).toBe('onmessage')
		expect(wsSpans[2].kind).toBe(SpanKind.CONSUMER)
		expect(wsSpans[2].attributes['http.response_content_length']).toBe(8)
		expect(wsSpans[2].attributes.protocol).toBe('foo')

		socket.close()
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

		await new Promise((resolve) => setTimeout(resolve, 1000))
		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		expect(wsSpans).toHaveLength(3)
		expect(wsSpans[0].attributes.protocols).toBe('["foo","bar"]')
		expect(wsSpans[1].attributes.protocol).toBe('foo')
		socket.close()
	})

	// FIXME find a way to make send throw..

	it('can report failed connect to non-listening port', async () => {
		const socket = new WebSocket('ws://127.0.0.1:31874/', ['foo', 'bar']) // assuming no ws server running there...
		socket.addEventListener('error', () => {})

		await new Promise((resolve) => setTimeout(resolve, 1000))
		const wsSpans = capturer.spans.filter((span) => span.attributes.component === 'websocket')
		expect(wsSpans).toHaveLength(1)
		expect(wsSpans[0].attributes['http.url']).toBe('ws://127.0.0.1:31874/')
		expect(wsSpans[0].attributes.component).toBe('websocket')
		expect(wsSpans[0].name).toBe('connect')
		expect(wsSpans[0].attributes.error).toBe(true)

		socket.close()
	})

	it('Websocket keeps static values', () => {
		expect(WebSocket.CONNECTING).toBe(0)
		expect(WebSocket.OPEN).toBe(1)
		expect(WebSocket.CLOSING).toBe(2)
		expect(WebSocket.CLOSED).toBe(3)
	})
})
