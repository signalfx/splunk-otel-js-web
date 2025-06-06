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

import { Context, ContextManager, ROOT_CONTEXT } from '@opentelemetry/api'
import { unwrap } from 'shimmer'
import { getOriginalFunction, isFunction, wrapNatively } from './utils'
import { ContextManagerConfig } from './types'

type EventListenerWithOrig = EventListener & { _orig?: EventListener }

const ATTACHED_CONTEXT_KEY = '__splunk_context'

/**
 * Extends otel-web stack context manager.
 * Due to privates being unaccessible in subclasses (_enabled) need to copy-paste everything
 */
export class SplunkContextManager implements ContextManager {
	/**
	 * Keeps the reference to current context
	 */
	public _currentContext = ROOT_CONTEXT

	/**
	 * Event listeners wrapped to resume context from event registration
	 *
	 * _contextResumingListeners.get(Target).get(EventType).get(origListener)
	 */
	protected _contextResumingListeners = new WeakMap<
		EventTarget,
		Map<
			string,
			WeakMap<
				EventListener, // User defined
				EventListener // Wrapped
			>
		>
	>()

	/**
	 * whether the context manager is enabled or not
	 */
	protected _enabled = false

	protected _hashChangeContext: Context | null = null

	protected _messagePorts = new WeakMap<MessagePort, MessagePort>()

	constructor(protected _config: ContextManagerConfig = {}) {}

	/**
	 * Returns the active context
	 */
	active(): Context {
		return this._currentContext
	}

	/**
	 * Binds the certain context or the active one to the target function and then returns the target
	 * @param context A context (span) to be bind to target
	 * @param target a function or event emitter. When target or one of its callbacks is called,
	 *  the provided context will be used as the active context for the duration of the call.
	 */
	bind<T>(context: Context, target: T): T {
		// if no specific context to propagate is given, we use the current one
		if (isFunction(target)) {
			return this._bindFunction(target, context) as unknown as T
		}

		return target
	}

	/**
	 * Disable the context manager (clears the current context)
	 */
	disable(): this {
		if (!this._enabled) {
			return this
		}

		if (this._config.async) {
			this._unpatchTimeouts()
			this._unpatchPromise()
			this._unpatchMutationObserver()
			this._unpatchEvents()
			this._unpatchMessageChannel()
		}

		this._currentContext = ROOT_CONTEXT
		this._enabled = false
		return this
	}

	/**
	 * Enables the context manager and creates a default(root) context
	 */
	enable(): this {
		if (this._enabled) {
			return this
		}

		if (this._config.async) {
			this._patchTimeouts()
			this._patchPromise()
			this._patchMutationObserver()
			this._patchEvents()
			this._patchMessageChannel()
		}

		this._enabled = true
		this._currentContext = ROOT_CONTEXT
		return this
	}

	/**
	 * Calls the callback function [fn] with the provided [context]. If [context] is undefined then it will use the window.
	 * The context will be set as active
	 * @param context
	 * @param fn Callback function
	 * @param thisArg optional receiver to be used for calling fn
	 * @param args optional arguments forwarded to fn
	 */
	with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
		context: Context | null,
		fn: F,
		thisArg?: ThisParameterType<F>,
		...args: A
	): ReturnType<F> {
		try {
			this._config.onBeforeContextStart?.()
		} catch {
			// ignore any exceptions thrown by context hooks
		}
		const previousContext = this._currentContext
		this._currentContext = context || ROOT_CONTEXT

		// Observe for location.hash changes (as it isn't a (re)configurable property))
		const preLocationHash = location.hash
		try {
			const result = fn.call(thisArg, ...args)
			this._config.onBeforeContextEnd?.()
			return result
		} finally {
			this._currentContext = previousContext
			if (preLocationHash !== location.hash) {
				this._hashChangeContext = context
				// Cleanup as macrotask (as hash change can also be done by user)
				getOriginalFunction(setTimeout)(() => {
					if (this._hashChangeContext === context) {
						this._hashChangeContext = null
					}
				}, 33)
			}
		}
	}

	/**
	 *
	 * @param target Function to be executed within the context
	 * @param context
	 */
	protected _bindFunction<T extends (...args: unknown[]) => unknown>(target: T, context = ROOT_CONTEXT): T {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const manager = this
		const contextWrapper = function (this: unknown, ...args: unknown[]) {
			return manager.with(context, () => target.apply(this, args))
		}
		Object.defineProperty(contextWrapper, 'length', {
			enumerable: false,
			configurable: true,
			writable: false,
			value: target.length,
		})
		return contextWrapper as unknown as T
	}

	protected _getListenersMap(target: EventTarget, type: string): WeakMap<EventListener, EventListener> | undefined {
		if (!this._contextResumingListeners.has(target)) {
			this._contextResumingListeners.set(target, new Map())
		}

		const listenersByType = this._contextResumingListeners.get(target)
		if (!listenersByType?.has(type)) {
			listenersByType?.set(type, new WeakMap())
		}

		return listenersByType?.get(type)
	}

	protected _getWrappedEventListener<E extends EventListener>(orig: E, contextGetter: () => Context | null): E {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const manager = this

		return function (this: unknown, ...innerArgs) {
			const context = contextGetter()
			if (context && manager._enabled) {
				// @ts-expect-error on orig: Type 'void' is not assignable to type 'ReturnType<E>'.
				return manager.with(context, orig, this, ...innerArgs)
			} else {
				return orig.apply(this, innerArgs)
			}
		} as E
	}

	protected _patchEvents(): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const manager = this

		wrapNatively(
			XMLHttpRequest.prototype,
			'addEventListener',
			(original) =>
				function (this: EventTarget, ...args: Parameters<XMLHttpRequest['addEventListener']>) {
					if (isFunction(args[1])) {
						const wrappedListeners = manager._getListenersMap(this, args[0])
						let wrapped = wrappedListeners?.get(args[1])

						if (!wrapped) {
							wrapped = manager.bind(manager.active(), args[1])
							wrappedListeners?.set(args[1], wrapped)
						}

						args[1] = wrapped
					}

					return original.apply(this, args)
				},
		)

		wrapNatively(
			XMLHttpRequest.prototype,
			'removeEventListener',
			(original) =>
				function (this: EventTarget, ...args: Parameters<XMLHttpRequest['addEventListener']>) {
					if (isFunction(args[1])) {
						const wrappedListeners = manager._getListenersMap(this, args[0])
						const wrapped = wrappedListeners?.get(args[1])

						if (wrapped) {
							args[1] = wrapped
						}
					}

					return original.apply(this, args)
				},
		)
		;['onabort', 'onerror', 'onload', 'onloadend', 'onloadstart', 'onprogress', 'ontimeout'].forEach((prop) => {
			const descriptor = Object.getOwnPropertyDescriptor(XMLHttpRequestEventTarget.prototype, prop)
			if (!descriptor) {
				return
			}

			wrapNatively(
				descriptor,
				'get',
				(original) =>
					function (this: unknown) {
						const val = original?.call(this)
						// @ts-expect-error we set function._orig bellow
						if (isFunction(val) && val._orig) {
							// @ts-expect-error we set function._orig bellow
							return val._orig
						}

						return val
					},
			)
			wrapNatively(
				descriptor,
				'set',
				(original) =>
					function (this: unknown, value) {
						if (isFunction(value)) {
							const orig = value
							const wrapped = manager.bind(manager.active(), value)
							// @ts-expect-error coulda add it to function type
							wrapped._orig = orig
							value = wrapped
						}

						return original?.call(this, value)
					},
			)
			Object.defineProperty(XMLHttpRequestEventTarget.prototype, prop, descriptor)
		})

		// hashchange event/ window.onhashchange
		wrapNatively(
			Window.prototype,
			'addEventListener',
			(original) =>
				function (this: Window, ...args: Parameters<Window['addEventListener']>) {
					if (args[0] === 'hashchange' && isFunction(args[1])) {
						const wrappedListeners = manager._getListenersMap(this, args[0])
						let wrapped = wrappedListeners?.get(args[1])

						if (!wrapped) {
							wrapped = manager._getWrappedEventListener(args[1], () => manager._hashChangeContext)
							wrappedListeners?.set(args[1], wrapped)
						}

						args[1] = wrapped
					}

					return original.apply(this, args)
				},
		)

		const desc = Object.getOwnPropertyDescriptor(window, 'onhashchange')
		if (desc) {
			wrapNatively(
				desc,
				'get',
				(original) =>
					function (this: unknown) {
						const val = original?.call(this)
						// @ts-expect-error we set function._orig bellow
						if (isFunction(val) && val._orig) {
							// @ts-expect-error we set function._orig bellow
							return val._orig
						}

						return val
					},
			)
			wrapNatively(
				desc,
				'set',
				(original) =>
					function (this: Window, value) {
						if (isFunction(value)) {
							const wrapped = manager._getWrappedEventListener<EventListenerWithOrig>(
								value,
								() => manager._hashChangeContext,
							)
							wrapped._orig = value
							value = wrapped
						}

						return original?.call(this, value)
					},
			)
			Object.defineProperty(window, 'onhashchange', desc)
		}
	}

	protected _patchMessageChannel(): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const manager = this

		wrapNatively(
			window,
			'MessageChannel',
			(original) =>
				class WrappedMessagePort extends original {
					constructor(...args: []) {
						super(...args)

						// Copy ports onto known mapping
						manager._messagePorts.set(this.port1, this.port2)
						manager._messagePorts.set(this.port2, this.port1)

						// Give each port a field to attach context to
						Object.defineProperty(this.port1, ATTACHED_CONTEXT_KEY, {
							value: null,
							writable: true,
							enumerable: false,
						})
						Object.defineProperty(this.port2, ATTACHED_CONTEXT_KEY, {
							value: null,
							writable: true,
							enumerable: false,
						})
					}
				},
		)

		wrapNatively(
			MessagePort.prototype,
			'postMessage',
			(original) =>
				function (this: MessagePort, ...args: any[]) {
					const active = manager.active()

					if (!manager._messagePorts.has(this) || !active) {
						return original.apply(
							this,
							args as [message: any, options?: StructuredSerializeOptions | undefined],
						)
					}

					const target = manager._messagePorts.get(this) as MessagePort & Record<string, Context | null>
					target[ATTACHED_CONTEXT_KEY] = active
					const res = original.apply(
						this,
						args as [message: any, options?: StructuredSerializeOptions | undefined],
					)

					// Cleanup as macrotask (eg. in case port isn't used locally)
					getOriginalFunction(setTimeout)(() => {
						if (target[ATTACHED_CONTEXT_KEY] === active) {
							target[ATTACHED_CONTEXT_KEY] = null
						}
					}, 100)

					return res
				},
		)

		wrapNatively(
			MessagePort.prototype,
			'addEventListener',
			(original) =>
				function (
					this: MessagePort & Record<string, Context | null>,
					...args: Parameters<MessagePort['addEventListener']>
				) {
					if (args[0] === 'message' && isFunction(args[1])) {
						const wrappedListeners = manager._getListenersMap(this, args[0])
						let wrapped = wrappedListeners?.get(args[1])

						if (!wrapped) {
							wrapped = manager._getWrappedEventListener(args[1], () => this[ATTACHED_CONTEXT_KEY])
							wrappedListeners?.set(args[1], wrapped)
						}

						args[1] = wrapped
					}

					return original.apply(this, args)
				},
		)

		wrapNatively(
			MessagePort.prototype,
			'removeEventListener',
			(original) =>
				function (this: EventTarget, ...args: Parameters<MessagePort['addEventListener']>) {
					if (args[0] === 'message' && isFunction(args[1])) {
						const wrappedListeners = manager._getListenersMap(this, args[0])
						const wrapped = wrappedListeners?.get(args[1])

						if (wrapped) {
							args[1] = wrapped
						}
					}

					return original.apply(this, args)
				},
		)

		const desc = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage')
		if (desc) {
			wrapNatively(
				desc,
				'get',
				(original) =>
					function (this: unknown) {
						const val = original?.call(this)
						// @ts-expect-error we set function._orig bellow
						if (isFunction(val) && val._orig) {
							// @ts-expect-error we set function._orig bellow
							return val._orig
						}

						return val
					},
			)
			wrapNatively(
				desc,
				'set',
				(original) =>
					function (this: MessagePort & { [ATTACHED_CONTEXT_KEY]: Context | null }, value) {
						if (isFunction(value)) {
							const wrapped = manager._getWrappedEventListener<EventListenerWithOrig>(
								value,
								() => this[ATTACHED_CONTEXT_KEY],
							)
							wrapped._orig = value
							value = wrapped
						}

						return original?.call(this, value)
					},
			)
			Object.defineProperty(MessagePort.prototype, 'onmessage', desc)
		}
	}

	protected _patchMutationObserver(): void {
		// 1. Patch mutation observer in general to check if a context is offered to it
		// 2. on observe call check for known use cases and patch those to forward the context

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const manager = this

		wrapNatively(
			window,
			'MutationObserver',
			(original) =>
				class WrappedMutationObserver extends original {
					constructor(...args: [callback: MutationCallback]) {
						if (isFunction(args[0])) {
							const orig = args[0]
							args[0] = function (this: { [ATTACHED_CONTEXT_KEY]: Context | null }, ...innerArgs) {
								if (this[ATTACHED_CONTEXT_KEY] && manager._enabled) {
									return manager.with(this[ATTACHED_CONTEXT_KEY], orig, this, ...innerArgs)
								} else {
									return orig.apply(this, innerArgs)
								}
							}
						}

						super(...args)

						Object.defineProperty(this, ATTACHED_CONTEXT_KEY, {
							value: null,
							writable: true,
							enumerable: false,
						})
					}

					observe(...args: Parameters<MutationObserver['observe']>) {
						// Observing a text node (document.createTextNode)
						if (
							args[0] &&
							args[0] instanceof Text &&
							!args[0].parentNode &&
							args[1] &&
							args[1].characterData
						) {
							// Overwrite setting textNode.data to copy active context to mutation observer

							const observer = this as unknown as { [ATTACHED_CONTEXT_KEY]: Context | null }
							const target = args[0]
							const descriptor = Object.getOwnPropertyDescriptor(CharacterData.prototype, 'data')

							Object.defineProperty(target, 'data', {
								...descriptor,
								enumerable: false,
								set: function (...args) {
									const context = manager.active()
									if (context) {
										observer[ATTACHED_CONTEXT_KEY] = context
									}

									return descriptor?.set?.apply(this, args)
								},
							})
						}

						return super.observe(...args)
					}
				},
		)
	}

	protected _patchPromise(): void {
		if (!window.Promise) {
			return
		}

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const manager = this

		// On typings: Don't want to hardcode the amount of parameters for future-safe,
		// but using Parameters<...> ignores generics, causing type error, so copy-paste of lib.es5 & lib.es2018
		wrapNatively(
			Promise.prototype,
			'then',
			(original) =>
				function <T = unknown, TResult1 = T, TResult2 = never>(
					this: Promise<T>,
					...args: [
						onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
						onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
					]
				): Promise<TResult1 | TResult2> {
					manager.bindActiveToArgument(args, 0)
					manager.bindActiveToArgument(args, 1)

					return original.apply(this, args) as Promise<TResult1 | TResult2>
				},
		)

		wrapNatively(
			Promise.prototype,
			'catch',
			(original) =>
				function <T, TResult>(
					this: Promise<T>,
					...args: [onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null]
				) {
					manager.bindActiveToArgument(args, 0)

					return original.apply(this, args)
				},
		)

		wrapNatively(
			Promise.prototype,
			'finally',
			(original) =>
				function <T>(this: Promise<T>, ...args: [onfinally?: (() => void) | undefined | null]) {
					manager.bindActiveToArgument(args, 0)

					return original.apply(this, args)
				},
		)
	}

	protected _patchTimeouts(): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const manager = this

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore for some reason CI decides error is here while locally happens on next line
		wrapNatively(
			window,
			'setTimeout',
			(original) =>
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore expects __promisify__ for some reason
				function (this: unknown, ...args: Parameters<typeof setTimeout>) {
					// Don't copy parent context if the timeout is long enough that it isn't really
					// expected to happen within interaction (eg polling every second).
					// The value for that is a pretty arbitary decision so here's 1 frame at 30fps (1000/30)
					if (!args[1] || args[1] <= 34) {
						manager.bindActiveToArgument(args, 0)
					}

					return original.apply(this, args)
				},
		)

		if (window['setImmediate']) {
			wrapNatively(
				window,
				'setImmediate',
				(original) =>
					// @ts-expect-error expects __promisify__
					function (this: unknown, ...args: Parameters<typeof setImmediate>) {
						manager.bindActiveToArgument(args, 0)

						return original.apply(this, args)
					},
			)
		}

		if (window['requestAnimationFrame']) {
			wrapNatively(
				window,
				'requestAnimationFrame',
				(original) =>
					function (this: unknown, ...args: Parameters<typeof requestAnimationFrame>) {
						manager.bindActiveToArgument(args, 0)

						return original.apply(this, args)
					},
			)
		}
	}

	protected _unpatchEvents(): void {
		unwrap(XMLHttpRequest.prototype, 'addEventListener')
		unwrap(XMLHttpRequest.prototype, 'removeEventListener')
	}

	protected _unpatchMessageChannel(): void {
		unwrap(window, 'MessageChannel')
		unwrap(MessagePort.prototype, 'postMessage')
		unwrap(MessagePort.prototype, 'addEventListener')
		unwrap(MessagePort.prototype, 'removeEventListener')
		const desc = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage')
		if (!desc) {
			return
		}

		unwrap(desc, 'get')
		unwrap(desc, 'set')
		Object.defineProperty(MessagePort.prototype, 'onmessage', desc)
	}

	protected _unpatchMutationObserver(): void {
		unwrap(window, 'MutationObserver')
	}

	protected _unpatchPromise(): void {
		if (!window.Promise) {
			return
		}

		unwrap(Promise.prototype, 'then')
		unwrap(Promise.prototype, 'catch')
		unwrap(Promise.prototype, 'finally')
	}

	protected _unpatchTimeouts(): void {
		unwrap(window, 'setTimeout')
		if (window['setImmediate']) {
			unwrap(window, 'setImmediate')
		}
	}

	/**
	 * Bind current zone to function given in arguments
	 *
	 * @param args Arguments array
	 * @param index Argument index to patch
	 */
	protected bindActiveToArgument(args: unknown[], index: number): void {
		if (isFunction(args[index])) {
			// Bind callback to current context
			args[index] = this.bind(this.active(), args[index])
		}
	}
}
