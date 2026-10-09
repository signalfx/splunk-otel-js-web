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

import { context, Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { isUrlIgnored } from '@opentelemetry/core'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'
// FIXME convert into otel-js-contrib Plugin and upstream
import * as shimmer from 'shimmer'

import { isError } from '../types'
import { getSize, hasSizeLikeProperty } from '../utils/size'
import { VERSION } from '../version'

const DEFAULT_MAX_MESSAGE_SPANS_PER_CONNECTION = 100

export interface SplunkWebSocketInstrumentationConfig extends InstrumentationConfig {
	ignoreUrls?: (string | RegExp)[]
	/**
	 * Maximum number of send and receive spans emitted for one WebSocket connection.
	 * Additional messages are included in the aggregate counters on the close span.
	 * Set to zero for aggregate-only telemetry.
	 * @default 100
	 */
	maxMessageSpansPerConnection?: number
}

interface WebSocketState {
	connectionId: string
	currentReceiveSpan?: Span
	localCloseRequested: boolean
	maxBufferedAmount: number
	messageSequence: number
	messageSpansDropped: number
	messageSpansEmitted: number
	openedAt?: number
	receivedBytes: number
	receivedMessages: number
	sendErrors: number
	sentBytes: number
	sentMessages: number
}

export class SplunkWebSocketInstrumentation extends InstrumentationBase<SplunkWebSocketInstrumentationConfig> {
	private readonly listener2ws2patched = new WeakMap<
		EventListenerOrEventListenerObject,
		Map<WebSocket, EventListenerOrEventListenerObject>
	>()

	constructor(config: SplunkWebSocketInstrumentationConfig) {
		super('splunk-websocket', VERSION, config)
	}

	disable(): void {
		shimmer.unwrap(window, 'WebSocket')
	}

	enable(): void {
		const instrumentation = this
		function webSocketWrapper(): typeof WebSocket {
			class InstrumentedWebSocket extends WebSocket {
				constructor(url: string | URL, protocols?: string | string[]) {
					const stringUrl = typeof url === 'string' ? url : url.toString()
					if (isUrlIgnored(stringUrl, instrumentation._config.ignoreUrls)) {
						super(url, protocols)
						return
					}

					const connectSpan = instrumentation.tracer.startSpan('connect', {
						attributes: {
							component: 'websocket',
						},
						kind: SpanKind.CLIENT,
					})
					const connectionId = connectSpan.spanContext().spanId
					instrumentation.setCommonAttributes(connectSpan, stringUrl, connectionId)

					if (protocols) {
						if (typeof protocols === 'string') {
							connectSpan.setAttribute('protocols', protocols)
						} else {
							connectSpan.setAttribute('protocols', JSON.stringify(protocols))
						}
					}

					try {
						super(url, protocols)
					} catch (error) {
						if (isError(error)) {
							instrumentation.endSpanExceptionally(connectSpan, error)
						}

						throw error
					}

					const state: WebSocketState = {
						connectionId,
						localCloseRequested: false,
						maxBufferedAmount: 0,
						messageSequence: 0,
						messageSpansDropped: 0,
						messageSpansEmitted: 0,
						receivedBytes: 0,
						receivedMessages: 0,
						sendErrors: 0,
						sentBytes: 0,
						sentMessages: 0,
					}
					instrumentation.registerLifecycleListeners(this, connectSpan, state)
					instrumentation.patchEventListener(this, state)
					instrumentation.patchSend(this, state)
					instrumentation.patchClose(this, state)
				}
			}

			return InstrumentedWebSocket
		}
		shimmer.wrap(window, 'WebSocket', webSocketWrapper)
	}

	init(): void {}

	private addPatchedListener(
		ws: WebSocket,
		originalListener: EventListenerOrEventListenerObject,
		patchedListener: EventListenerOrEventListenerObject,
	) {
		let ws2patched = this.listener2ws2patched.get(originalListener)
		if (!ws2patched) {
			ws2patched = new Map()
			this.listener2ws2patched.set(originalListener, ws2patched)
		}

		if (ws2patched.has(ws)) {
			return false
		}

		ws2patched.set(ws, patchedListener)
		return true
	}

	private endSpanExceptionally(span: Span, err: Error) {
		span.setAttribute('error', true)
		span.setAttribute('error.message', err.message)
		span.setAttribute('error.object', err.name || err.constructor?.name || 'Error')
		span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
		span.end()
	}

	private getMaxMessageSpansPerConnection() {
		const configuredLimit = this._config.maxMessageSpansPerConnection
		if (configuredLimit === undefined || !Number.isFinite(configuredLimit) || configuredLimit < 0) {
			return DEFAULT_MAX_MESSAGE_SPANS_PER_CONNECTION
		}

		return Math.floor(configuredLimit)
	}

	private getMessageSize(data: unknown) {
		if (!hasSizeLikeProperty(data)) {
			return 0
		}

		const size = Number(getSize(data))
		return Number.isFinite(size) && size >= 0 ? size : 0
	}

	private getMessageType(data: unknown) {
		return typeof data === 'string' ? 'text' : 'binary'
	}

	private patchClose(ws: WebSocket, state: WebSocketState) {
		const origClose = ws.close
		ws.close = function instrumentedClose(...args) {
			const canInitiateClose = ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN
			const result = origClose.apply(ws, args)
			if (canInitiateClose) {
				state.localCloseRequested = true
			}

			return result
		}
	}

	private patchEventListener(ws: WebSocket, state: WebSocketState) {
		const instrumentation = this
		const originalAddEventListener: WebSocket['addEventListener'] = ws.addEventListener.bind(ws)

		ws.addEventListener = function instrumentedAddEventListener(
			type: string,
			callback: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions,
		): void {
			if (type !== 'message') {
				originalAddEventListener(type, callback, options)
				return
			}

			const once = typeof options === 'boolean' ? false : options?.once
			const patchedCallback = function patchedAddEventListenerCallback(this: WebSocket, event: Event) {
				if (once) {
					instrumentation.removePatchedListener(ws, callback)
				}

				const invokeCallback = () =>
					typeof callback === 'function' ? callback.call(this, event) : callback.handleEvent(event)
				const receiveSpan = state.currentReceiveSpan
				if (!receiveSpan) {
					return invokeCallback()
				}

				return context.with(trace.setSpan(context.active(), receiveSpan), invokeCallback)
			}

			if (instrumentation.addPatchedListener(ws, callback, patchedCallback)) {
				originalAddEventListener(type, patchedCallback, options)
			}
		}

		const originalRemoveEventListener = ws.removeEventListener
		ws.removeEventListener = function instrumentedRemoveEventListener(
			type: string,
			callback: EventListenerOrEventListenerObject,
			options?: boolean | EventListenerOptions,
		): void {
			if (type !== 'message') {
				originalRemoveEventListener.call(ws, type, callback, options)
				return
			}

			const patchedCallback = instrumentation.removePatchedListener(ws, callback)
			originalRemoveEventListener.call(ws, type, patchedCallback ?? callback, options)
		}
	}

	private patchSend(ws: WebSocket, state: WebSocketState) {
		const instrumentation = this
		const origSend = ws.send
		ws.send = function instrumentedSend(...args) {
			const data = args[0]
			const size = instrumentation.getMessageSize(data)
			const span = instrumentation.startMessageSpan(ws, state, 'send', SpanKind.PRODUCER, 'send', data, size)

			try {
				const result = origSend.apply(ws, args)
				state.sentMessages += 1
				state.sentBytes += size
				state.maxBufferedAmount = Math.max(state.maxBufferedAmount, ws.bufferedAmount)
				span?.end()
				return result
			} catch (error) {
				if (isError(error)) {
					state.sendErrors += 1
					if (span) {
						instrumentation.endSpanExceptionally(span, error)
					}
				}

				throw error
			}
		}
	}

	private registerLifecycleListeners(ws: WebSocket, connectSpan: Span, state: WebSocketState) {
		ws.addEventListener('open', () => {
			state.openedAt = performance.now()
			connectSpan.setAttribute('protocol', ws.protocol)
			connectSpan.setAttribute('websocket.subprotocol', ws.protocol)
			connectSpan.end()
		})
		ws.addEventListener('message', (event) => {
			const size = this.getMessageSize(event.data)
			state.receivedMessages += 1
			state.receivedBytes += size
			const span = this.startMessageSpan(ws, state, 'onmessage', SpanKind.CONSUMER, 'receive', event.data, size)
			if (span) {
				state.currentReceiveSpan = span
				setTimeout(() => {
					span.end()
					if (state.currentReceiveSpan === span) {
						state.currentReceiveSpan = undefined
					}
				}, 0)
			}
		})
		ws.addEventListener('error', (event: Event) => {
			if (connectSpan.isRecording()) {
				let message = 'Could not connect.'
				if ('error' in event && typeof event.error === 'string' && event.error) {
					message = event.error
				} else if ('message' in event && typeof event.message === 'string' && event.message) {
					message = event.message
				}

				this.endSpanExceptionally(connectSpan, new Error(message))
			} else {
				this.startSpan(ws, state.connectionId, 'error', SpanKind.CLIENT).end()
			}
		})
		ws.addEventListener('close', (event) => {
			if (connectSpan.isRecording()) {
				this.endSpanExceptionally(connectSpan, new Error('Connection closed before opening.'))
			}

			const closeSpan = this.startSpan(ws, state.connectionId, 'close', SpanKind.CLIENT)
			closeSpan.setAttribute('websocket.close.code', event.code)
			closeSpan.setAttribute(
				'websocket.close.initiator',
				state.localCloseRequested ? 'client' : 'server_or_network',
			)
			closeSpan.setAttribute('websocket.close.was_clean', event.wasClean)
			closeSpan.setAttribute('websocket.message.received.bytes', state.receivedBytes)
			closeSpan.setAttribute('websocket.message.received.count', state.receivedMessages)
			closeSpan.setAttribute('websocket.message.sent.bytes', state.sentBytes)
			closeSpan.setAttribute('websocket.message.sent.count', state.sentMessages)
			closeSpan.setAttribute('websocket.message.send.errors', state.sendErrors)
			closeSpan.setAttribute('websocket.message.spans.dropped', state.messageSpansDropped)
			closeSpan.setAttribute('websocket.buffered_amount.max', state.maxBufferedAmount)
			if (state.openedAt !== undefined) {
				closeSpan.setAttribute('websocket.connection.open_duration_ms', performance.now() - state.openedAt)
			}

			closeSpan.end()
		})
	}

	private removePatchedListener(ws: WebSocket, originalListener: EventListenerOrEventListenerObject) {
		const ws2patched = this.listener2ws2patched.get(originalListener)
		if (!ws2patched) {
			return
		}

		const patchedListener = ws2patched.get(ws)
		if (patchedListener) {
			ws2patched.delete(ws)
			if (ws2patched.size === 0) {
				this.listener2ws2patched.delete(originalListener)
			}
		}

		return patchedListener
	}

	private sanitizeUrl(url: string) {
		try {
			const parsedUrl = new URL(url, window.location.href)
			parsedUrl.username = ''
			parsedUrl.password = ''
			parsedUrl.search = ''
			parsedUrl.hash = ''
			return parsedUrl.toString()
		} catch {
			return url.split(/[?#]/, 1)[0]
		}
	}

	private setCommonAttributes(span: Span, url: string, connectionId: string) {
		const sanitizedUrl = this.sanitizeUrl(url)
		span.setAttribute('component', 'websocket')
		span.setAttribute('http.url', sanitizedUrl)
		span.setAttribute('network.protocol.name', 'websocket')
		span.setAttribute('network.transport', 'tcp')
		span.setAttribute('websocket.connection.id', connectionId)

		try {
			const parsedUrl = new URL(sanitizedUrl, window.location.href)
			span.setAttribute('server.address', parsedUrl.hostname)
			span.setAttribute('url.scheme', parsedUrl.protocol.replace(':', ''))
			if (parsedUrl.port) {
				span.setAttribute('server.port', Number(parsedUrl.port))
			}
		} catch {
			// Keep the sanitized URL even when parsing a non-standard implementation-specific URL fails.
		}
	}

	private startMessageSpan(
		ws: WebSocket,
		state: WebSocketState,
		name: string,
		spanKind: SpanKind,
		direction: 'receive' | 'send',
		data: unknown,
		size: number,
	) {
		if (state.messageSpansEmitted >= this.getMaxMessageSpansPerConnection()) {
			state.messageSpansDropped += 1
			return
		}

		state.messageSpansEmitted += 1
		state.messageSequence += 1
		const span = this.startSpan(ws, state.connectionId, name, spanKind)
		span.setAttribute('websocket.message.direction', direction)
		span.setAttribute('websocket.message.sequence', state.messageSequence)
		span.setAttribute('websocket.message.size', size)
		span.setAttribute('websocket.message.type', this.getMessageType(data))
		if (direction === 'send') {
			span.setAttribute('http.request_content_length', size)
		} else {
			span.setAttribute('http.response_content_length', size)
		}

		return span
	}

	private startSpan(ws: WebSocket, connectionId: string, name: string, spanKind: SpanKind) {
		const span = this.tracer.startSpan(name, { kind: spanKind })
		this.setCommonAttributes(span, ws.url, connectionId)
		span.setAttribute('protocol', ws.protocol)
		span.setAttribute('websocket.subprotocol', ws.protocol)
		return span
	}
}
