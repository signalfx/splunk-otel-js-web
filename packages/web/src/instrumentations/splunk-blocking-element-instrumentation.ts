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

import { diag } from '@opentelemetry/api'
import { InstrumentationBase } from '@opentelemetry/instrumentation'

import type { SessionManager, SpaMetricsManager } from '../managers'
import type { ElementVisibilityChangeEvent, ElementVisibilityObserver } from '../observers/element-visibility-observer'
import type { SplunkBlockingElementInstrumentationConfig, SplunkOtelWebConfig } from '../types'

import { VERSION } from '../version'
import { BLOCKING_ELEMENT_MODULE_NAME } from './blocking-element/constants'
import { ElementSpanTracker } from './blocking-element/element-span-tracker'
import {
	isBlockingElementInstrumentationEnabled,
	resolveBlockingElementSelectors,
	resolveMaxElementSpanDuration,
} from './blocking-element/support'

// once: true means the browser removes this listener for us after it fires; no re-entry guard needed.
const PAGEHIDE_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, once: true }
const PAGEHIDE_LISTENER_REMOVE_OPTIONS: EventListenerOptions = { capture: true }

/**
 * DOM watching itself is delegated to the shared ElementVisibilityObserver — this class only
 * derives per-element span lifecycle from the per-element events it receives.
 */
export class SplunkBlockingElementInstrumentation extends InstrumentationBase<SplunkBlockingElementInstrumentationConfig> {
	private readonly activeSelectorsByElement = new Map<Element, Set<string>>()

	private readonly consumerId = Symbol('splunk-blocking-element')

	private elementSpanTracker: ElementSpanTracker | undefined

	private readonly elementVisibilityObserver: ElementVisibilityObserver

	private selectors: string[] = []

	private warnedInvalidSelectors = new Set<string>()

	constructor(
		config: SplunkBlockingElementInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
		_sessionManager?: SessionManager,
		_spaMetricsManager?: SpaMetricsManager,
		elementVisibilityObserver?: ElementVisibilityObserver,
	) {
		super(BLOCKING_ELEMENT_MODULE_NAME, VERSION, { ...config, enabled: false })
		if (!elementVisibilityObserver) {
			throw new Error('SplunkBlockingElementInstrumentation requires elementVisibilityObserver.')
		}

		this.elementVisibilityObserver = elementVisibilityObserver
	}

	disable(): void {
		window.removeEventListener('pagehide', this.handlePagehide, PAGEHIDE_LISTENER_REMOVE_OPTIONS)

		// Interrupt before unwatch() so open spans end as 'interrupted', not 'completed' — unwatch()'s
		// synthesized visible:false events would otherwise reach handleVisibilityChange and complete
		// them as if they'd resolved normally, same ordering LoadingElementMonitor.stop() relies on.
		this.elementSpanTracker?.interruptAll()
		this.elementSpanTracker = undefined
		this.selectors = []
		this.activeSelectorsByElement.clear()
		this.elementVisibilityObserver.unwatch(this.consumerId)
	}

	enable(): void {
		if (!isBlockingElementInstrumentationEnabled(this.otelConfig)) {
			return
		}

		this.selectors = resolveBlockingElementSelectors(this.otelConfig)
		if (this.selectors.length === 0) {
			return
		}

		this.elementSpanTracker = new ElementSpanTracker(
			this.tracer,
			this.selectors,
			resolveMaxElementSpanDuration(this.otelConfig),
		)
		this.elementVisibilityObserver.watch(this.consumerId, this.selectors, this.handleVisibilityChange)
		window.addEventListener('pagehide', this.handlePagehide, PAGEHIDE_LISTENER_OPTIONS)
	}

	init(): void {}

	// Ends open spans as 'interrupted' without unwatching the shared observer — pagehide doesn't
	// guarantee the page is truly gone (bfcache can restore it later), so leave the subscription
	// intact rather than tearing down as if disable() had been called.
	private readonly handlePagehide = (): void => {
		this.elementSpanTracker?.interruptAll()
	}

	private readonly handleVisibilityChange = (event: ElementVisibilityChangeEvent): void => {
		const elementSpanTracker = this.elementSpanTracker
		if (!elementSpanTracker) {
			return
		}

		const { element, selector, visible } = event
		const now = performance.now()

		if (!visible) {
			// The observer's events are per (selector, element) pair, not per element — an element
			// matching two configured selectors can drop out of one while still matching the other,
			// producing a visible:false for only the dropped selector. Only complete the span once
			// the element's active-selector set is empty, i.e. it no longer matches anything configured.
			const activeSelectors = this.activeSelectorsByElement.get(element)
			activeSelectors?.delete(selector)
			if (activeSelectors && activeSelectors.size > 0) {
				return
			}

			this.activeSelectorsByElement.delete(element)
			elementSpanTracker.completeSpan(element, now)
			return
		}

		const matchedSelectors = this.selectors.filter((matchedSelector) =>
			this.matchesSelector(element, matchedSelector),
		)
		this.activeSelectorsByElement.set(element, new Set(matchedSelectors))
		elementSpanTracker.startSpan(element, matchedSelectors, now)
	}

	private matchesSelector(element: Element, selector: string): boolean {
		try {
			return element.matches(selector)
		} catch (error) {
			if (!this.warnedInvalidSelectors.has(selector)) {
				this.warnedInvalidSelectors.add(selector)
				diag.warn('SplunkBlockingElementInstrumentation: Invalid blocking element selector.', {
					error,
					selector,
				})
			}

			return false
		}
	}
}
