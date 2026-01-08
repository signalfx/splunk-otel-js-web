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

import { diag, Span, trace, Tracer, TracerProvider } from '@opentelemetry/api'
import { isUrlIgnored } from '@opentelemetry/core'

import { SpaMetricsManager } from '../managers'
import { SplunkOtelWebConfig } from '../types'
import { UserInteractionInstrumentation } from '../upstream/user-interaction/instrumentation'
import { UserInteractionInstrumentationConfig } from '../upstream/user-interaction/types'

export type UserInteractionEventsConfig = {
	[type: string]: boolean
}

export const DEFAULT_AUTO_INSTRUMENTED_EVENTS: UserInteractionEventsConfig = {
	change: true,
	click: true,
	dblclick: true,
	dragend: true,
	drop: true,
	ended: true,
	mousedown: true,
	mouseup: true,
	pause: true,
	play: true,
	reset: true,
	submit: true,
}
export const DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES = Object.keys(
	DEFAULT_AUTO_INSTRUMENTED_EVENTS,
) as (keyof HTMLElementEventMap)[]

const ROUTING_INSTRUMENTATION_NAME = 'route'
const ROUTING_INSTRUMENTATION_VERSION = '1'

export interface SplunkUserInteractionInstrumentationConfig extends UserInteractionInstrumentationConfig {
	events?: UserInteractionEventsConfig
	ignoreUrls?: (string | RegExp)[]
}

function isPatchableEventListener(listener: Parameters<EventTarget['addEventListener']>[1]) {
	return (
		listener &&
		(typeof listener === 'function' || (typeof listener === 'object' && typeof listener.handleEvent === 'function'))
	)
}

type EventName = keyof HTMLElementEventMap
type ExposedSuper = {
	_createSpan: (element: EventTarget | null | undefined, eventName: EventName, parentSpan?: Span) => Span | undefined
	_patchAddEventListener: () => (original: EventTarget['addEventListener']) => EventTarget['addEventListener']
}

export class SplunkUserInteractionInstrumentation extends UserInteractionInstrumentation<SplunkUserInteractionInstrumentationConfig> {
	private __hashChangeHandler: ((ev: Event) => void) | undefined

	private _routingTracer: Tracer

	private spaMetricsManager: SpaMetricsManager | null = null

	constructor(config: SplunkUserInteractionInstrumentationConfig = {}, otelConfig: SplunkOtelWebConfig) {
		// Prefer otel's eventNames property
		if (!config.eventNames) {
			const eventMap = Object.assign({}, DEFAULT_AUTO_INSTRUMENTED_EVENTS, config.events)

			const eventNames = Object.entries(eventMap)
				.filter(([, enabled]) => enabled)
				.map(([eventName]) => eventName) as (keyof HTMLElementEventMap)[]
			config.eventNames = eventNames
		}

		super(config, otelConfig)

		if (otelConfig._experimentalSPAMetrics) {
			const spaMetricConfig =
				otelConfig._experimentalSPAMetrics === true ? {} : otelConfig._experimentalSPAMetrics

			this.spaMetricsManager = new SpaMetricsManager({
				beaconEndpoint: otelConfig.beaconEndpoint,
				...spaMetricConfig,
			})
		}

		this._routingTracer = trace.getTracer(ROUTING_INSTRUMENTATION_NAME, ROUTING_INSTRUMENTATION_VERSION)

		const _superCreateSpan = (this as unknown as ExposedSuper)._createSpan.bind(this)
		;(this as unknown as ExposedSuper)._createSpan = (
			element: EventTarget | HTMLElement | Document | null | undefined,
			eventName: EventName,
			parentSpan?: Span,
		) => {
			// Fix: No span is created when event is captured from document
			if (element === document) {
				element = document.documentElement
			}

			const span = _superCreateSpan(element, eventName, parentSpan)
			if (span) {
				span.setAttribute('component', this.moduleName)
			}

			return span
		}

		const _superPatchAddEventListener = (this as unknown as ExposedSuper)._patchAddEventListener.bind(this)
		;(this as unknown as ExposedSuper)._patchAddEventListener = () => {
			const patcher = _superPatchAddEventListener()

			return (original) => {
				const patchedListener = patcher(original)
				// Fix: Error when .addEventListener(type, listener, null)
				return function (
					this: EventTarget,
					type: keyof HTMLElementEventMap,
					listener: EventListenerOrEventListenerObject | null,
					useCapture?: boolean | AddEventListenerOptions,
				) {
					// Only forward to otel if it can patch it
					if (!isPatchableEventListener(listener)) {
						return original.call(this, type, listener, useCapture)
					}

					if (useCapture === null) {
						useCapture = undefined
					}

					return patchedListener.call(this, type, listener, useCapture)
				}
			}
		}
	}

	// FIXME find cleaner way to patch
	_patchHistoryMethod(): (original: any) => (this: History, ...args: unknown[]) => any {
		const that = this
		return (original) =>
			function patchHistoryMethod(...args) {
				const oldHref = location.href
				const result = original.apply(this, args)
				const newHref = location.href
				if (oldHref !== newHref) {
					void that._emitRouteChangeSpan(oldHref)
				}

				return result
			}
	}

	disable(): void {
		super.disable()
		if (this.__hashChangeHandler) {
			window.removeEventListener('hashchange', this.__hashChangeHandler)
		}

		this.spaMetricsManager?.stop()
	}

	enable(): void {
		this.spaMetricsManager?.start()

		this.__hashChangeHandler = (event: Event) => {
			void this._emitRouteChangeSpan((event as HashChangeEvent).oldURL)
		}

		// Hash can be changed with location.hash = '#newThing', no way to hook that directly...
		window.addEventListener('hashchange', this.__hashChangeHandler)

		super.enable()
	}

	getZoneWithPrototype(): undefined {
		// FIXME work out ngZone issues with Angular  PENDING
		return undefined
	}

	setTracerProvider(tracerProvider: TracerProvider): void {
		super.setTracerProvider(tracerProvider)
		this._routingTracer = tracerProvider.getTracer(ROUTING_INSTRUMENTATION_NAME, ROUTING_INSTRUMENTATION_VERSION)
	}

	private async _emitRouteChangeSpan(oldHref: string) {
		const config = this.getConfig()
		if (isUrlIgnored(location.href, config.ignoreUrls)) {
			return
		}

		const now = Date.now()
		const span = this._routingTracer.startSpan('routeChange', { startTime: now })
		span.setAttribute('component', this.moduleName)
		span.setAttribute('prev.href', oldHref)
		// location.href set with new value by default

		if (this.spaMetricsManager) {
			// Wait for all in-flight resources (XHR, fetch, media) to finish loading,
			// then resolve after a quiet period with no new network activity.
			const { loadTime, timestampOfLastLoadedResource } = await this.spaMetricsManager.waitForPageLoad({
				startTime: performance.now(),
			})

			span.end(now + loadTime)
			diag.debug('Route change span ended', { loadTime, span, timestampOfLastLoadedResource })
		} else {
			span.end(now)
		}
	}
}
