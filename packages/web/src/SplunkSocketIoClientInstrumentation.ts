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

import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'
import {
	MessagingDestinationKindValues,
	MessagingOperationValues,
	SemanticAttributes,
} from '@opentelemetry/semantic-conventions'
import { waitForGlobal } from './utils'
import { VERSION } from './version'

const MODULE_NAME = 'splunk-socket.io-client'

/*
 * Subset of socket.IO parts we patch so we can avoid a hard dependency on
 * socket.io-client due to types
 */

interface SocketIOSocket {
	(...args: unknown[]): unknown

	nsp: string

	prototype: {
		addEventListener(ev: string, listener: (...args: unknown[]) => void): ThisParameterType<SocketIOSocket>
		emit(ev: string, ...args: unknown[]): ThisParameterType<SocketIOSocket>
		off(ev?: string, listener?: (...args: unknown[]) => void): ThisParameterType<SocketIOSocket>
		on(ev: string, listener: (...args: unknown[]) => void): ThisParameterType<SocketIOSocket>
		removeAllListeners(ev?: string): ThisParameterType<SocketIOSocket>
		removeEventListener(ev?: string, listener?: (...args: unknown[]) => void): ThisParameterType<SocketIOSocket>
		removeListener(ev?: string, listener?: (...args: unknown[]) => void): ThisParameterType<SocketIOSocket>
	}
}

interface SocketIOClient {
	(...args: unknown[]): unknown
	Manager: () => void
	Socket: SocketIOSocket
}

// Aligned with aspecto's server side socket.io instrumentations
// https://github.com/aspecto-io/opentelemetry-ext-js/blob/d98dabe288b1d95ce7e3d8b9b2ccc3ed02854392/packages/instrumentation-socket.io/src/types.ts#L8
const SocketIoInstrumentationAttributes = {
	SOCKET_IO_ROOMS: 'messaging.socket.io.rooms',
	SOCKET_IO_NAMESPACE: 'messaging.socket.io.namespace',
	SOCKET_IO_EVENT_NAME: 'messaging.socket.io.event_name',
}

export interface SocketIoClientInstrumentationConfig extends InstrumentationConfig {
	/**
	 * Target object or the key it will be set on window.
	 *
	 * Not explicitly typed to avoid dependency on socket-io client
	 */
	target?: string | SocketIOClient
}

function seemsLikeSocketIoClient(io: unknown): io is SocketIOClient {
	return typeof io === 'function' && typeof (io as SocketIOClient).Socket === 'function'
}

// Events that can't be emitted over the socket
// https://github.com/socketio/socket.io-client/blob/eaf782c41b9b92d4f39aa221a4166de4a30fb560/lib/socket.ts#L22
const RESERVED_EVENTS = ['connect', 'connect_error', 'disconnect', 'disconnecting', 'newListener', 'removeListener']

export class SplunkSocketIoClientInstrumentation extends InstrumentationBase {
	_onDisable?: () => void

	protected listeners = new WeakMap<(...args: unknown[]) => void, (...args: unknown[]) => void>()

	constructor(config: SocketIoClientInstrumentationConfig = {}) {
		super(MODULE_NAME, VERSION, Object.assign({ target: 'io' }, config))
	}

	disable(): void {
		if (this._onDisable) {
			this._onDisable()
			this._onDisable = undefined
		}
	}

	enable(): void {
		const config = this.getConfig()

		if (!config.target) {
			return
		}

		if (typeof config.target === 'string') {
			this._onDisable = waitForGlobal(config.target, (io: SocketIOClient) => this.patchSocketIo(io))
		} else {
			this.patchSocketIo(config.target)
		}
	}

	override getConfig(): SocketIoClientInstrumentationConfig {
		return this._config
	}

	protected init(): void {}

	protected patchSocketIo(io: SocketIOClient): void {
		if (!seemsLikeSocketIoClient(io)) {
			this._diag.debug("Doesn't seem like socket.io-client", io)
			return
		}

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const inst = this

		this._wrap(
			io.Socket.prototype,
			'emit',
			(original) =>
				function (this: SocketIOSocket, eventName: string, ...args) {
					const span = inst.tracer.startSpan(`${eventName} send`, {
						kind: SpanKind.PRODUCER,
						attributes: {
							[SemanticAttributes.MESSAGING_SYSTEM]: 'socket.io',
							[SemanticAttributes.MESSAGING_DESTINATION]: this.nsp,
							[SemanticAttributes.MESSAGING_DESTINATION_KIND]: MessagingDestinationKindValues.TOPIC,
							[SocketIoInstrumentationAttributes.SOCKET_IO_NAMESPACE]: this.nsp,
							[SocketIoInstrumentationAttributes.SOCKET_IO_EVENT_NAME]: eventName,
						},
					})

					try {
						return context.with(trace.setSpan(context.active(), span), () =>
							original.apply(this, [eventName, ...args]),
						)
					} catch (error) {
						let message: string | undefined
						if (error instanceof Error) {
							span.recordException(error)
							message = error.message
						}

						span.setStatus({ code: SpanStatusCode.ERROR, message })
						throw error
					} finally {
						span.end()
					}
				},
		)

		this._wrap(
			io.Socket.prototype,
			'on',
			(original) =>
				function (this: unknown, eventName: string, listener) {
					if (RESERVED_EVENTS.includes(eventName) || typeof listener !== 'function') {
						return original.call(this, eventName, listener)
					}

					let wrappedListener = inst.listeners.get(listener)

					if (!wrappedListener) {
						wrappedListener = function (this: SocketIOSocket, ...args: unknown[]) {
							const span = inst.tracer.startSpan(`${eventName} ${MessagingOperationValues.RECEIVE}`, {
								kind: SpanKind.CONSUMER,
								attributes: {
									[SemanticAttributes.MESSAGING_SYSTEM]: 'socket.io',
									[SemanticAttributes.MESSAGING_DESTINATION]: this.nsp,
									[SemanticAttributes.MESSAGING_DESTINATION_KIND]:
										MessagingDestinationKindValues.TOPIC,
									[SemanticAttributes.MESSAGING_OPERATION]: MessagingOperationValues.RECEIVE,
									[SocketIoInstrumentationAttributes.SOCKET_IO_NAMESPACE]: this.nsp,
									[SocketIoInstrumentationAttributes.SOCKET_IO_EVENT_NAME]: eventName,
								},
							})

							try {
								listener.apply(this, args)
							} catch (error) {
								if (error instanceof Error) {
									span.recordException(error)
								}

								throw error
							} finally {
								span.end()
							}
						}
						inst.listeners.set(listener, wrappedListener)
					}

					return original.call(this, eventName, wrappedListener)
				},
		)
		io.Socket.prototype.addEventListener = io.Socket.prototype.on

		this._wrap(
			io.Socket.prototype,
			'off',
			(original) =>
				// all of the remove are implemented as one function
				// https://github.com/socketio/emitter/blob/cd703fe28e5bf85ecf137b0e6422e2608c0eefbf/index.js#L81
				function (this: unknown, eventName?: string, listener?: (...args: unknown[]) => void) {
					if (!eventName || RESERVED_EVENTS.includes(eventName) || typeof listener !== 'function') {
						return original.call(this, eventName, listener)
					}

					if (inst.listeners.has(listener)) {
						return original.call(this, eventName, inst.listeners.get(listener))
					} else {
						return original.call(this, eventName, listener)
					}
				},
		)
		io.Socket.prototype.removeListener = io.Socket.prototype.off
		io.Socket.prototype.removeEventListener = io.Socket.prototype.off
		io.Socket.prototype.removeAllListeners = io.Socket.prototype.off

		this._onDisable = () => {
			this._unwrap(io.Socket.prototype, 'emit')
			this._unwrap(io.Socket.prototype, 'on')
			io.Socket.prototype.addEventListener = io.Socket.prototype.on
			this._unwrap(io.Socket.prototype, 'off')
			io.Socket.prototype.removeListener = io.Socket.prototype.off
			io.Socket.prototype.removeEventListener = io.Socket.prototype.off
			io.Socket.prototype.removeAllListeners = io.Socket.prototype.off
		}
	}
}
