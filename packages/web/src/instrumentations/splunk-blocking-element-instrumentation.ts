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

import type { NavigationMetricsManager, SessionManager } from '../managers'
import type { ElementVisibilityChangeEvent, ElementVisibilityObserver } from '../observers/element-visibility-observer'
import type { SplunkBlockingElementInstrumentationConfig, SplunkOtelWebConfig } from '../types'

import { VERSION } from '../version'
import {
	BLOCKING_ELEMENT_MODULE_NAME,
	BROWSER_ELEMENT_COMPLETION_INTERRUPTED,
	BROWSER_ELEMENT_COMPLETION_VISIBILITY_HIDDEN,
} from './blocking-element/constants'
import { ElementSpanTracker } from './blocking-element/element-span-tracker'
import {
	isBlockingElementInstrumentationEnabled,
	resolveBlockingElementSelectors,
	resolveMaxElementSpanDuration,
} from './blocking-element/support'

// No once: true — pagehide can fire more than once per page if the browser bfcache-restores it
// (pageshow with persisted: true) and it's later hidden again; each hide must still interrupt.
const PAGEHIDE_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true }
const PAGESHOW_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true }
const DOCUMENT_VISIBLE_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true }

/**
 * DOM watching itself is delegated to the shared ElementVisibilityObserver — this class only
 * derives per-element span lifecycle from the per-element events it receives.
 */
export class SplunkBlockingElementInstrumentation extends InstrumentationBase<SplunkBlockingElementInstrumentationConfig> {
	private readonly activeSelectorsByElement = new Map<Element, Set<string>>()

	private readonly consumerId = Symbol('splunk-blocking-element')

	private elementSpanTracker: ElementSpanTracker | undefined

	private readonly elementVisibilityObserver: ElementVisibilityObserver

	private hasEnabled = false

	private readonly navigationMetricsManager: NavigationMetricsManager | undefined

	private routeChangeUnsubscribe: (() => void) | undefined

	private selectors: string[] = []

	/** Elements timed out by ElementSpanTracker while still visible; prevents a second span until they go invisible. */
	private readonly timedOutElements = new Set<Element>()

	constructor(
		config: SplunkBlockingElementInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
		_sessionManager?: SessionManager,
		navigationMetricsManager?: NavigationMetricsManager,
		elementVisibilityObserver?: ElementVisibilityObserver,
	) {
		super(BLOCKING_ELEMENT_MODULE_NAME, VERSION, { ...config, enabled: false })
		if (!elementVisibilityObserver) {
			throw new Error('SplunkBlockingElementInstrumentation requires elementVisibilityObserver.')
		}

		this.elementVisibilityObserver = elementVisibilityObserver
		this.navigationMetricsManager = navigationMetricsManager
	}

	disable(): void {
		this.hasEnabled = false
		this.routeChangeUnsubscribe?.()
		this.routeChangeUnsubscribe = undefined

		window.removeEventListener('pagehide', this.handlePagehide, PAGEHIDE_LISTENER_OPTIONS)
		window.removeEventListener('pageshow', this.handlePageshow, PAGESHOW_LISTENER_OPTIONS)
		window.removeEventListener('visibilitychange', this.handleDocumentVisible, DOCUMENT_VISIBLE_LISTENER_OPTIONS)

		// Interrupt before unwatch() so open spans end as 'interrupted', not 'completed' — unwatch()'s
		// synthesized visible:false events would otherwise reach handleVisibilityChange and complete
		// them as if they'd resolved normally, same ordering LoadingElementMonitor.stop() relies on.
		this.elementSpanTracker?.interruptAll(BROWSER_ELEMENT_COMPLETION_INTERRUPTED)
		this.elementSpanTracker = undefined
		this.selectors = []
		this.activeSelectorsByElement.clear()
		this.timedOutElements.clear()
		this.elementVisibilityObserver.unwatch(this.consumerId)
	}

	enable(): void {
		if (this.hasEnabled) {
			diag.warn('SplunkBlockingElementInstrumentation: Already enabled.')
			return
		}

		this.hasEnabled = true
		this.elementSpanTracker = new ElementSpanTracker(
			this.tracer,
			resolveMaxElementSpanDuration(this.otelConfig),
			(element) => this.timedOutElements.add(element),
		)
		window.addEventListener('pagehide', this.handlePagehide, PAGEHIDE_LISTENER_OPTIONS)
		window.addEventListener('pageshow', this.handlePageshow, PAGESHOW_LISTENER_OPTIONS)
		window.addEventListener('visibilitychange', this.handleDocumentVisible, DOCUMENT_VISIBLE_LISTENER_OPTIONS)
		this.routeChangeUnsubscribe = this.navigationMetricsManager?.onRouteChange(this.applySelectors)

		this.applySelectors()
	}

	init(): void {}

	// Called from index.ts on visibilitychange->hidden, before the app's forceFlush() — ending open
	// spans here (not just on pagehide) so they make it into the export buffer before that flush.
	// Does not unwatch(): a later visibilitychange->visible reopens still-visible elements.
	interruptForHidden(): void {
		this.elementSpanTracker?.interruptAll(BROWSER_ELEMENT_COMPLETION_VISIBILITY_HIDDEN)
		this.activeSelectorsByElement.clear()
		this.timedOutElements.clear()
	}

	// Re-resolves selectors/enablement and re-applies via watch() — disabled-or-empty is just
	// "watch nothing," not a distinct branch. Called at enable() and on every route change.
	private readonly applySelectors = (): void => {
		this.selectors = isBlockingElementInstrumentationEnabled(this.otelConfig)
			? resolveBlockingElementSelectors(this.otelConfig)
			: []
		this.elementVisibilityObserver.watch(this.consumerId, this.selectors, this.handleVisibilityChange)
	}

	// No competing listener/ordering requirement on this side (unlike hidden's flush race), so this
	// stays self-contained here rather than routed through index.ts.
	private readonly handleDocumentVisible = (): void => {
		if (document.visibilityState !== 'visible') {
			return
		}

		for (const selector of this.selectors) {
			this.elementVisibilityObserver.resync(this.consumerId, selector)
		}
	}

	// Ends open spans as 'interrupted' without unwatching the shared observer — pagehide doesn't
	// guarantee the page is truly gone (bfcache can restore it later), so leave the subscription
	// intact rather than tearing down as if disable() had been called. Also clears our own
	// active-selector bookkeeping, since a bfcache restore resumes with no DOM mutation to naturally
	// refresh it — handlePageshow's resync() is what repopulates it for elements still visible.
	private readonly handlePagehide = (): void => {
		this.elementSpanTracker?.interruptAll(BROWSER_ELEMENT_COMPLETION_INTERRUPTED)
		this.activeSelectorsByElement.clear()
		this.timedOutElements.clear()
	}

	// Only meaningful for a bfcache restore (event.persisted) — the DOM is frozen as-is across the
	// freeze/restore, so the observer never sees a mutation to naturally rediscover elements that
	// were already visible before pagehide. resync() forces a fresh look per configured selector so
	// spans reopen for anything still visible, instead of silently going untracked for the rest of
	// the page's life.
	private readonly handlePageshow = (event: PageTransitionEvent): void => {
		if (!event.persisted) {
			return
		}

		for (const selector of this.selectors) {
			this.elementVisibilityObserver.resync(this.consumerId, selector)
		}
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
			// Real episode boundary — a future reappearance deserves a fresh span.
			this.timedOutElements.delete(element)
			elementSpanTracker.completeSpan(element, now)
			return
		}

		// The shared observer keeps watching while hidden (see interruptForHidden), so a mutation while
		// still hidden can otherwise start a span with a background-time start. Ignore it here — the
		// visibilitychange->visible resync (handleDocumentVisible) re-delivers it correctly once visible.
		if (document.visibilityState === 'hidden') {
			return
		}

		const matchedSelectors = this.selectors.filter((matchedSelector) =>
			this.matchesSelector(element, matchedSelector),
		)
		this.activeSelectorsByElement.set(element, new Set(matchedSelectors))

		// Tracker already timed this element out while still visible; avoid opening a second span.
		if (this.timedOutElements.has(element)) {
			return
		}

		elementSpanTracker.startSpan(element, matchedSelectors, now)
	}

	// The observer already validates and warns once per invalid selector (same this.selectors list
	// passed to watch()) — no need to duplicate that warning here.
	private matchesSelector(element: Element, selector: string): boolean {
		try {
			return element.matches(selector)
		} catch {
			return false
		}
	}
}
