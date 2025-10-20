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

import * as api from '@opentelemetry/api'
import { InstrumentationBase, isWrapped } from '@opentelemetry/instrumentation'
import { getElementXPath } from '@opentelemetry/sdk-trace-web'

import { PrivacyManager, PrivacyManagerConfig } from '../../managers/privacy/privacy-manager'
import { isNode, SplunkOtelWebConfig } from '../../types'
import { getTextFromNode } from '../../utils/index'
import { AttributeNames } from './enums/attribute-names'
import { SpanData } from './internal-types'
import { EventName, ShouldPreventSpanCreation, UserInteractionInstrumentationConfig } from './types'
import { VERSION } from './version'

const EVENT_NAVIGATION_NAME = 'Navigation:'
const DEFAULT_EVENT_NAMES: EventName[] = ['click']

function defaultShouldPreventSpanCreation() {
	return false
}

/**
 * This class represents a UserInteraction plugin for auto instrumentation.
 * If zone.js is available then it patches the zone otherwise it patches
 * addEventListener of Element
 */
export class UserInteractionInstrumentation<
	T extends UserInteractionInstrumentationConfig,
> extends InstrumentationBase<T> {
	readonly moduleName: string = 'user-interaction'

	readonly version = VERSION

	private _eventNames: Set<EventName>

	// for event bubbling
	private _eventsSpanMap: WeakMap<Event, api.Span> = new WeakMap<Event, api.Span>()

	private _lastClickTimes: number[] = []

	private _otelConfig: SplunkOtelWebConfig

	private _privacyManager: PrivacyManager

	private _shouldPreventSpanCreation: ShouldPreventSpanCreation

	private _spansData = new WeakMap<api.Span, SpanData>()

	// for addEventListener/removeEventListener state
	private _wrappedListeners = new WeakMap<
		EventListenerOrEventListenerObject,
		Map<string, Map<Element, EventListenerOrEventListenerObject>>
	>()

	private _zonePatched?: boolean

	constructor(config: T, otelConfig: SplunkOtelWebConfig) {
		super('@opentelemetry/instrumentation-user-interaction', VERSION, config)
		this._eventNames = new Set(config?.eventNames ?? DEFAULT_EVENT_NAMES)
		this._shouldPreventSpanCreation =
			typeof config?.shouldPreventSpanCreation === 'function'
				? config.shouldPreventSpanCreation
				: defaultShouldPreventSpanCreation

		const privacy: PrivacyManagerConfig = {
			maskAllText: true,
			sensitivityRules: [],
			...otelConfig.privacy,
		}

		this._otelConfig = otelConfig
		this._privacyManager = new PrivacyManager(privacy)
	}

	/**
	 * Patches the history api
	 */
	_patchHistoryApi() {
		this._unpatchHistoryApi()

		this._wrap(history, 'replaceState', this._patchHistoryMethod())
		this._wrap(history, 'pushState', this._patchHistoryMethod())
		this._wrap(history, 'back', this._patchHistoryMethod())
		this._wrap(history, 'forward', this._patchHistoryMethod())
		this._wrap(history, 'go', this._patchHistoryMethod())
	}

	/**
	 * Patches the certain history api method
	 */
	_patchHistoryMethod() {
		const instrumentation = this
		return (original: any) =>
			function patchHistoryMethod(this: History, ...args: unknown[]) {
				const url = `${location.pathname}${location.hash}${location.search}`
				const result = original.apply(this, args)
				const urlAfter = `${location.pathname}${location.hash}${location.search}`
				if (url !== urlAfter) {
					instrumentation._updateInteractionName(urlAfter)
				}

				return result
			}
	}

	/**
	 * unpatch the history api methods
	 */
	_unpatchHistoryApi() {
		if (isWrapped(history.replaceState)) {
			this._unwrap(history, 'replaceState')
		}

		if (isWrapped(history.pushState)) {
			this._unwrap(history, 'pushState')
		}

		if (isWrapped(history.back)) {
			this._unwrap(history, 'back')
		}

		if (isWrapped(history.forward)) {
			this._unwrap(history, 'forward')
		}

		if (isWrapped(history.go)) {
			this._unwrap(history, 'go')
		}
	}

	/**
	 * Updates interaction span name
	 * @param url
	 */
	_updateInteractionName(url: string) {
		const span: api.Span | undefined = api.trace.getSpan(api.context.active())
		if (span && typeof span.updateName === 'function') {
			span.updateName(`${EVENT_NAVIGATION_NAME} ${url}`)
		}
	}

	/**
	 * implements unpatch function
	 */
	override disable() {
		const targets = this._getPatchableEventTargets()
		targets.forEach((target) => {
			if (isWrapped(target.addEventListener)) {
				this._unwrap(target, 'addEventListener')
			}

			if (isWrapped(target.removeEventListener)) {
				this._unwrap(target, 'removeEventListener')
			}
		})

		this._unpatchHistoryApi()
	}

	/**
	 * implements enable function
	 */
	override enable() {
		this._zonePatched = false
		const targets = this._getPatchableEventTargets()
		targets.forEach((target) => {
			if (isWrapped(target.addEventListener)) {
				this._unwrap(target, 'addEventListener')
				this._diag.debug('removing previous patch from method addEventListener')
			}

			if (isWrapped(target.removeEventListener)) {
				this._unwrap(target, 'removeEventListener')
				this._diag.debug('removing previous patch from method removeEventListener')
			}

			this._wrap(target, 'addEventListener', this._patchAddEventListener())
			this._wrap(target, 'removeEventListener', this._patchRemoveEventListener())
		})

		this._patchHistoryApi()
	}

	/**
	 * returns Zone
	 */
	getZoneWithPrototype(): undefined {
		return undefined
	}

	init() {}

	/**
	 * Controls whether or not to create a span, based on the event type.
	 */
	protected _allowEventName(eventName: EventName): boolean {
		return this._eventNames.has(eventName)
	}

	/**
	 * Creates a new span
	 * @param element
	 * @param eventName
	 * @param parentSpan
	 */
	private _createSpan(
		element: EventTarget | null | undefined,
		eventName: EventName,
		parentSpan?: api.Span,
	): api.Span | undefined {
		if (!(element instanceof Element)) {
			return undefined
		}

		if (!element.getAttribute) {
			return undefined
		}

		if (element.hasAttribute('disabled')) {
			return undefined
		}

		if (!this._allowEventName(eventName)) {
			return undefined
		}

		const xpath = getElementXPath(element, true)
		try {
			const span = this.tracer.startSpan(
				eventName,
				{
					attributes: {
						[AttributeNames.EVENT_TYPE]: eventName,
						[AttributeNames.HTTP_URL]: window.location.href,
						[AttributeNames.TARGET_ELEMENT]: element.tagName,
						[AttributeNames.TARGET_XPATH]: xpath,
					},
				},
				parentSpan ? api.trace.setSpan(api.context.active(), parentSpan) : undefined,
			)

			if (this._shouldPreventSpanCreation(eventName, element, span) === true) {
				return undefined
			}

			this._spansData.set(span, {
				taskCount: 0,
			})

			return span
		} catch (error) {
			this._diag.error('failed to start create new user interaction span', error)
		}
		return undefined
	}

	/**
	 * Most browser provide event listener api via EventTarget in prototype chain.
	 * Exception to this is IE 11 which has it on the prototypes closest to EventTarget:
	 *
	 * * - has addEventListener in IE
	 * ** - has addEventListener in all other browsers
	 * ! - missing in IE
	 *
	 * Element -> Node * -> EventTarget **! -> Object
	 * Document -> Node * -> EventTarget **! -> Object
	 * Window * -> WindowProperties ! -> EventTarget **! -> Object
	 */
	private _getPatchableEventTargets(): EventTarget[] {
		return window.EventTarget ? [EventTarget.prototype] : [Node.prototype, Window.prototype]
	}

	// utility method to deal with the Function|EventListener nature of addEventListener
	private _invokeListener(listener: EventListenerOrEventListenerObject, target: any, args: [evt: Event]): any {
		return typeof listener === 'function' ? listener.apply(target, args) : listener.handleEvent(args[0])
	}

	/**
	 * This patches the addEventListener of Element to be able to
	 * auto instrument the click events
	 * This is done when zone is not available
	 */
	private _patchAddEventListener() {
		const instrumentation = this
		return (original: EventTarget['addEventListener']) =>
			function addEventListenerPatched(
				this: Element,
				type: keyof (ElementEventMap & HTMLElementEventMap),
				listener: EventListenerOrEventListenerObject | null,
				useCapture?: boolean | AddEventListenerOptions,
			) {
				// Forward calls with listener = null
				if (!listener) {
					return original.call(this, type, listener, useCapture)
				}

				// filter out null (typeof null === 'object')
				const once = useCapture && typeof useCapture === 'object' && useCapture.once
				const patchedListener = function (this: Element, ...args: [evt: Event]) {
					const event = args[0]
					const parentSpan = instrumentation._eventsSpanMap.get(event)
					const target = event?.target

					if (once) {
						instrumentation.removePatchedListener(this, type, listener)
					}

					const span = instrumentation._createSpan(target, type, parentSpan)

					if (!span) {
						return instrumentation._invokeListener(listener, this, args)
					}

					if (event.type === 'click' && event.target && isNode(event.target)) {
						const interactions = instrumentation._otelConfig.instrumentations?.interactions
						if (typeof interactions === 'object' && typeof interactions?.rageClick === 'object') {
							const currentTime = Date.now()
							const { count = 3, ignoreSelectors = [], timeframeSeconds = 1 } = interactions.rageClick

							instrumentation._lastClickTimes = instrumentation._lastClickTimes.filter(
								(time) => currentTime - time < timeframeSeconds * 1000 /* convert to ms */,
							)
							instrumentation._lastClickTimes.push(currentTime)
							if (instrumentation._lastClickTimes.length >= count) {
								const ignored = ignoreSelectors.some((selector) =>
									(event.target as Element).matches(selector),
								)
								if (!ignored) {
									// TODO generate a special rage click span or event
								}
							}
						}

						const textValue = getTextFromNode(
							event.target,
							(node) => !instrumentation._privacyManager.shouldMaskTextNode(node),
						)

						span.setAttribute('target_text', textValue || `<${event.target.nodeName.toLowerCase()}>`)
					}

					instrumentation._eventsSpanMap.set(event, span)

					return api.context.with(api.trace.setSpan(api.context.active(), span), () => {
						const result = instrumentation._invokeListener(listener, this, args)
						// no zone so end span immediately
						span.end()
						return result
					})
				}
				if (instrumentation.addPatchedListener(this, type, listener, patchedListener)) {
					return original.call(this, type, patchedListener, useCapture)
				}
			}
	}

	/**
	 * This patches the removeEventListener of Element to handle the fact that
	 * we patched the original callbacks
	 * This is done when zone is not available
	 */
	private _patchRemoveEventListener() {
		const instrumentation = this
		return (
			original: (
				type: string,
				listener: EventListenerOrEventListenerObject | null,
				options?: boolean | EventListenerOptions,
			) => void,
		) =>
			function removeEventListenerPatched(
				this: Element,
				type: keyof (ElementEventMap & HTMLElementEventMap),
				listener: EventListenerOrEventListenerObject | null,
				useCapture?: boolean | EventListenerOptions,
			) {
				const wrappedListener = listener && instrumentation.removePatchedListener(this, type, listener)
				return wrappedListener
					? original.call(this, type, wrappedListener, useCapture)
					: original.call(this, type, listener, useCapture)
			}
	}

	/**
	 * Returns true if we should use the patched callback; false if it's already been patched
	 */
	private addPatchedListener(
		on: Element,
		type: string,
		listener: EventListenerOrEventListenerObject,
		wrappedListener: (...args: [evt: Event]) => void,
	): boolean {
		let listener2Type = this._wrappedListeners.get(listener)
		if (!listener2Type) {
			listener2Type = new Map()
			this._wrappedListeners.set(listener, listener2Type)
		}

		let element2patched = listener2Type.get(type)
		if (!element2patched) {
			element2patched = new Map()
			listener2Type.set(type, element2patched)
		}

		if (element2patched.has(on)) {
			return false
		}

		element2patched.set(on, wrappedListener)
		return true
	}

	/**
	 * Returns the patched version of the callback (or undefined)
	 */
	private removePatchedListener(
		on: Element,
		type: string,
		listener: EventListenerOrEventListenerObject,
	): EventListenerOrEventListenerObject | undefined {
		const listener2Type = this._wrappedListeners.get(listener)
		if (!listener2Type) {
			return undefined
		}

		const element2patched = listener2Type.get(type)
		if (!element2patched) {
			return undefined
		}

		const patched = element2patched.get(on)
		if (patched) {
			element2patched.delete(on)
			if (element2patched.size === 0) {
				listener2Type.delete(type)
				if (listener2Type.size === 0) {
					this._wrappedListeners.delete(listener)
				}
			}
		}

		return patched
	}
}
