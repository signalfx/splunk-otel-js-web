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
import { io } from 'socket.io-client'
import { SplunkOtelWebConfig } from '../src/types'
import { SpanKind } from '@opentelemetry/api'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('can produce websocket events', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				socketio: {
					target: io,
				},
			},
		} as Partial<SplunkOtelWebConfig>)
	})

	afterEach(() => {
		deinit()
	})

	it('produces spans from emit', async () => {
		const socket = io('http://127.0.0.1:8980')
		socket.on('connect', () => {
			socket.emit('hello')
		})

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')

		expect(sioSpans).toHaveLength(1)

		expect(sioSpans[0].name).toBe('hello send')
		expect(sioSpans[0].kind).toBe(SpanKind.PRODUCER)
		expect(sioSpans[0].attributes['messaging.destination']).toBe('/')

		expect(sioSpans[0].attributes['messaging.socket.io.namespace']).toBe('/')

		expect(sioSpans[0].attributes['messaging.socket.io.event_name']).toBe('hello')

		socket.disconnect()
	})

	it('produces spans from event listener', async () => {
		const socket = io('http://127.0.0.1:8980')

		socket.on('connect', () => {
			socket.emit('ping')
		})

		await new Promise<void>((resolve) => {
			socket.on('pong', () => {
				setTimeout(resolve, 1000)
			})
		})

		const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')

		expect(sioSpans).toHaveLength(2)

		expect(sioSpans[0].name).toBe('ping send')
		expect(sioSpans[1].name).toBe('pong receive')
		expect(sioSpans[1].kind).toBe(SpanKind.CONSUMER)
		expect(sioSpans[1].attributes['messaging.destination']).toBe('/')

		expect(sioSpans[1].attributes['messaging.socket.io.namespace']).toBe('/')
		expect(sioSpans[1].attributes['messaging.socket.io.event_name']).toBe('pong')

		socket.disconnect()
	})

	it('removing event listener', async () => {
		const socket = io('http://127.0.0.1:8980')

		await new Promise<void>((resolve) => {
			function tempListener() {
				throw new Error('Called removed listener')
			}

			function connectListener() {
				socket.off('pong', tempListener)
				socket.on('pong', () => {
					resolve()
				})
				socket.emit('ping')
			}

			socket.on('pong', tempListener)
			socket.on('connect', connectListener)
		})
	})
})

describe('window global io', () => {
	let capturer

	beforeEach(() => {
		// @ts-expect-error io isn't standard window prop
		window.io = io
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				socketio: true,
			},
		} as Partial<SplunkOtelWebConfig>)
	})

	afterEach(() => {
		deinit()
		// @ts-expect-error io isn't standard window prop
		delete window.io
	})

	it('produces spans from emit', async () => {
		// @ts-expect-error See beforeEach
		const socket = (window.io as typeof io)('http://127.0.0.1:8980')
		socket.on('connect', () => {
			socket.emit('hello')
		})

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')

		expect(sioSpans).toHaveLength(1)

		socket.disconnect()
	})
})

describe('window global io (loaded after init)', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				socketio: true,
			},
		} as Partial<SplunkOtelWebConfig>)
		// @ts-expect-error io isn't standard window prop
		window.io = io
	})
	afterEach(() => {
		deinit()
		// @ts-expect-error io isn't standard window prop
		delete window.io
	})

	it('produces spans from emit', async () => {
		// @ts-expect-error See beforeEach
		const socket = (window.io as typeof io)('http://127.0.0.1:8980')
		socket.on('connect', () => {
			socket.emit('hello')
		})

		await new Promise((resolve) => setTimeout(resolve, 1000))

		const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')
		expect(sioSpans).toHaveLength(1)

		socket.disconnect()
	})
})
