/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import * as assert from 'assert'
import { deinit, initWithDefaultConfig, SpanCapturer } from './utils'
import { io } from 'socket.io-client'
import { SpanKind } from '@opentelemetry/api'
import { SplunkOtelWebConfig } from '../src/types'

describe('can produce websocket events', () => {
	let capturer

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

	it('produces spans from emit', (done) => {
		const socket = io('http://127.0.0.1:8980')
		socket.on('connect', () => {
			socket.emit('hello')

			setTimeout(() => {
				const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')

				assert.strictEqual(sioSpans.length, 1, 'Should have 1 socket.io span')

				assert.strictEqual(sioSpans[0].name, 'hello send')
				assert.strictEqual(sioSpans[0].kind, SpanKind.PRODUCER)
				assert.strictEqual(
					sioSpans[0].attributes['messaging.destination'],
					'/',
					'messaging.destination attribute',
				)
				assert.strictEqual(
					sioSpans[0].attributes['messaging.socket.io.namespace'],
					'/',
					'messaging.socket.io.namespace attribute',
				)
				assert.strictEqual(
					sioSpans[0].attributes['messaging.socket.io.event_name'],
					'hello',
					'messaging.socket.io.event_name attribute',
				)

				socket.disconnect()
				done()
			}, 10)
		})
	})

	it('produces spans from event listener', (done) => {
		const socket = io('http://127.0.0.1:8980')

		socket.on('connect', () => {
			socket.emit('ping')
		})
		socket.on('pong', () => {
			setTimeout(() => {
				const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')

				assert.strictEqual(sioSpans.length, 2, 'Should have 2 socket.io span')

				assert.strictEqual(sioSpans[0].name, 'ping send')
				assert.strictEqual(sioSpans[1].name, 'pong receive')
				assert.strictEqual(sioSpans[1].kind, SpanKind.CONSUMER)
				assert.strictEqual(
					sioSpans[1].attributes['messaging.destination'],
					'/',
					'messaging.destination attribute',
				)
				assert.strictEqual(
					sioSpans[1].attributes['messaging.socket.io.namespace'],
					'/',
					'messaging.socket.io.namespace attribute',
				)
				assert.strictEqual(
					sioSpans[1].attributes['messaging.socket.io.event_name'],
					'pong',
					'messaging.socket.io.event_name attribute',
				)

				socket.disconnect()
				done()
			}, 10)
		})
	})

	it('removing event listener', (done) => {
		const socket = io('http://127.0.0.1:8980')

		function tempListener() {
			assert.fail('Called removed listener')
		}
		function connectListener() {
			socket.off('pong', tempListener)
			socket.on('pong', () => {
				assert.ok(true, 'No fails called before this')
				done()
			})
			socket.emit('ping')
		}

		socket.on('pong', tempListener)
		socket.on('connect', connectListener)
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

	it('produces spans from emit', (done) => {
		// @ts-expect-error See beforeEach
		const socket = (window.io as typeof io)('http://127.0.0.1:8980')
		socket.on('connect', () => {
			socket.emit('hello')

			setTimeout(() => {
				const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')
				assert.strictEqual(sioSpans.length, 1, 'Should have 1 socket.io span')

				socket.disconnect()
				done()
			}, 10)
		})
	})
})

describe('window global io (loaded after init)', () => {
	let capturer

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

	it('produces spans from emit', (done) => {
		// @ts-expect-error See beforeEach
		const socket = (window.io as typeof io)('http://127.0.0.1:8980')
		socket.on('connect', () => {
			socket.emit('hello')

			setTimeout(() => {
				const sioSpans = capturer.spans.filter((span) => span.attributes['messaging.system'] === 'socket.io')
				assert.strictEqual(sioSpans.length, 1, 'Should have 1 socket.io span')

				socket.disconnect()
				done()
			}, 10)
		})
	})
})
