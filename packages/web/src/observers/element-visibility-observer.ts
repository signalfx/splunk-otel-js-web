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

import { isElement } from '../types'

export type ElementVisibilityChangeEvent = {
	element: Element
	selector: string
	visible: boolean
}

export type ElementVisibilityCallback = (event: ElementVisibilityChangeEvent) => void

/**
 * Watches CSS selectors for visibility changes on behalf of any number of consumers, sharing one
 * MutationObserver and one querySelectorAll/visibility scan per distinct selector, regardless of
 * how many consumers watch the same selector. Reports per-element changes only; has no opinion
 * about what a change means to any given consumer.
 */
export class ElementVisibilityObserver {
	/** key: consumerId -> value: that consumer's onChange callback, registered via watch(). */
	private callbacks = new Map<symbol, ElementVisibilityCallback>()

	/** key: selector -> value: consumerIds currently watching that selector. */
	private consumersBySelector = new Map<string, Set<symbol>>()

	private observer: MutationObserver | null = null

	private scanTimeoutId: ReturnType<typeof setTimeout> | undefined

	/** key: selector -> value: elements matching that selector as of the last scan. */
	private visibleElementsBySelector = new Map<string, Set<Element>>()

	/** Selectors already warned about, so an invalid selector only logs once. */
	private warnedInvalidSelectors = new Set<string>()

	/**
	 * Forces a fresh scan for selector and gives consumerId full current-state events for it, as if
	 * it had just joined — without changing its subscription. For when a consumer's own bookkeeping
	 * was cleared independently of any real visibility change (e.g. a resource forgotten for
	 * unrelated config reasons) and it needs to resynchronize without waiting for some future,
	 * unrelated DOM mutation to happen to trigger a scan. No-ops if consumerId isn't watching
	 * selector.
	 */
	resync(consumerId: symbol, selector: string): void {
		if (!this.consumersBySelector.get(selector)?.has(consumerId)) {
			return
		}

		this.scanSelector(selector, consumerId)
	}

	/** Removes a consumer entirely: drops it from every selector and forgets its callback. */
	unwatch(consumerId: symbol): void {
		const onChange = this.callbacks.get(consumerId)
		if (!onChange) {
			return
		}

		this.dropConsumerFromAllSelectors(consumerId, onChange)
		this.callbacks.delete(consumerId)
		this.syncMutationObserver()
	}

	/**
	 * Replaces a consumer's watched selector list entirely: adds what's new, then drops what's no
	 * longer included — additions first so a still-visible element crossing from an old selector to
	 * its replacement never sees a false "no active selectors" gap in between.
	 */
	watch(consumerId: symbol, selectors: string[], onChange: ElementVisibilityCallback): void {
		this.callbacks.set(consumerId, onChange)

		const nextSelectors = new Set(selectors)

		// No-ops if already watching; otherwise scans fresh, even if another consumer already tracks it.
		for (const selector of nextSelectors) {
			this.addConsumerToSelector(consumerId, selector)
		}

		for (const [selector, consumers] of this.consumersBySelector) {
			// This consumer was watching selector before, but the new list no longer includes it.
			if (consumers.has(consumerId) && !nextSelectors.has(selector)) {
				this.dropConsumerFromSelector(consumerId, selector, onChange)
			}
		}

		this.syncMutationObserver()
	}

	/**
	 * Always runs a fresh scan for selector, even if another consumer already tracks it — replaying
	 * the cached visibleElementsBySelector instead would risk handing the joining consumer state
	 * that's already gone stale, if a DOM mutation landed after the last scan but before this
	 * consumer joined (route change calling watch() synchronously races the debounced
	 * MutationObserver scan for an unrelated pending mutation).
	 */
	private addConsumerToSelector(consumerId: symbol, selector: string): void {
		if (this.consumersBySelector.get(selector)?.has(consumerId)) {
			return
		}

		if (!this.consumersBySelector.has(selector)) {
			this.consumersBySelector.set(selector, new Set())
		}

		this.consumersBySelector.get(selector)?.add(consumerId)
		this.scanSelector(selector, consumerId)
	}

	private clearScheduledScan(): void {
		if (this.scanTimeoutId === undefined) {
			return
		}

		clearTimeout(this.scanTimeoutId)
		this.scanTimeoutId = undefined
	}

	/** Recomputes selector's visible set and reports which elements newly appeared/disappeared, without notifying anyone. */
	private computeVisibilityDelta(selector: string): {
		appeared: Element[]
		currentlyVisible: Set<Element>
		disappeared: Element[]
	} {
		const previouslyVisible = this.visibleElementsBySelector.get(selector) ?? new Set<Element>()
		const currentlyVisible = this.getVisibleMatches(selector)
		this.visibleElementsBySelector.set(selector, currentlyVisible)

		const appeared: Element[] = []
		for (const element of currentlyVisible) {
			if (!previouslyVisible.has(element)) {
				appeared.push(element)
			}
		}

		const disappeared: Element[] = []
		for (const element of previouslyVisible) {
			if (!currentlyVisible.has(element)) {
				disappeared.push(element)
			}
		}

		return { appeared, currentlyVisible, disappeared }
	}

	/**
	 * Removes consumerId from selector's watchers and, if it was previously watching a currently
	 * visible element under that selector, emits one final `visible: false` event for it so the
	 * dropping consumer can tear its own state down without needing to re-scan.
	 */
	private dropConsumerFromAllSelectors(consumerId: symbol, onChange: ElementVisibilityCallback): void {
		for (const selector of this.consumersBySelector.keys()) {
			if (this.consumersBySelector.get(selector)?.has(consumerId)) {
				this.dropConsumerFromSelector(consumerId, selector, onChange)
			}
		}
	}

	private dropConsumerFromSelector(consumerId: symbol, selector: string, onChange: ElementVisibilityCallback): void {
		this.consumersBySelector.get(selector)?.delete(consumerId)

		const visibleElements = this.visibleElementsBySelector.get(selector)
		if (visibleElements) {
			for (const element of visibleElements) {
				// An element matching multiple watched selectors gets one event per selector, never
				// combined — reconciling an element's full selector-match set is the consumer's job.
				try {
					onChange({ element, selector, visible: false })
				} catch (error) {
					diag.warn('ElementVisibilityObserver: Consumer callback threw.', { error })
				}
			}
		}

		if (this.consumersBySelector.get(selector)?.size === 0) {
			this.consumersBySelector.delete(selector)
			this.visibleElementsBySelector.delete(selector)
		}
	}

	/** Queries the DOM for selector and returns only the currently-visible matches; warns once on invalid syntax. */
	private getVisibleMatches(selector: string): Set<Element> {
		let elements: NodeListOf<Element>
		try {
			elements = document.querySelectorAll(selector)
		} catch (error) {
			if (!this.warnedInvalidSelectors.has(selector)) {
				this.warnedInvalidSelectors.add(selector)
				diag.warn('ElementVisibilityObserver: Invalid selector.', { error, selector })
			}

			return new Set()
		}

		return new Set(Array.from(elements).filter((element) => this.isElementVisible(element)))
	}

	/** Isolates one consumer's callback so a thrown error can't stop other consumers from being notified. */
	private invokeCallback(consumerId: symbol, event: ElementVisibilityChangeEvent): void {
		try {
			this.callbacks.get(consumerId)?.(event)
		} catch (error) {
			diag.warn('ElementVisibilityObserver: Consumer callback threw.', { error })
		}
	}

	private isElementVisible(element: Element): boolean {
		if (!element.isConnected || element.hasAttribute('hidden') || element.getClientRects().length === 0) {
			return false
		}

		const style = getComputedStyle(element)
		return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
	}

	private notify(consumers: Set<symbol>, event: ElementVisibilityChangeEvent): void {
		for (const consumerId of consumers) {
			this.invokeCallback(consumerId, event)
		}
	}

	/**
	 * joiningConsumerId, if given, gets full current-state visible:true events for every currently
	 * visible element (it has no prior state to diff against) and is excluded from the ordinary
	 * delta notification below, so it never gets double-notified for elements that are both
	 * already-visible and part of this scan's true delta.
	 */
	private scanSelector(selector: string, joiningConsumerId?: symbol): void {
		const { appeared, currentlyVisible, disappeared } = this.computeVisibilityDelta(selector)

		const allConsumers = this.consumersBySelector.get(selector) ?? new Set<symbol>()
		const deltaConsumers =
			joiningConsumerId === undefined
				? allConsumers
				: new Set([...allConsumers].filter((id) => id !== joiningConsumerId))

		if (joiningConsumerId !== undefined) {
			for (const element of currentlyVisible) {
				this.invokeCallback(joiningConsumerId, { element, selector, visible: true })
			}
		}

		for (const element of appeared) {
			this.notify(deltaConsumers, { element, selector, visible: true })
		}

		for (const element of disappeared) {
			this.notify(deltaConsumers, { element, selector, visible: false })
		}
	}

	/**
	 * Recomputes every selector before notifying any of them, so an element swapping selectors in
	 * one mutation gets its arrival notified before its departure.
	 */
	private scanSelectors(): void {
		this.clearScheduledScan()

		const appearedEvents: Array<{ element: Element; selector: string }> = []
		const disappearedEvents: Array<{ element: Element; selector: string }> = []

		for (const selector of this.consumersBySelector.keys()) {
			const { appeared, disappeared } = this.computeVisibilityDelta(selector)
			for (const element of appeared) {
				appearedEvents.push({ element, selector })
			}

			for (const element of disappeared) {
				disappearedEvents.push({ element, selector })
			}
		}

		// All arrivals notified first, across every selector, before any departure — see above.
		for (const { element, selector } of appearedEvents) {
			this.notify(this.consumersBySelector.get(selector) ?? new Set(), { element, selector, visible: true })
		}

		for (const { element, selector } of disappearedEvents) {
			this.notify(this.consumersBySelector.get(selector) ?? new Set(), { element, selector, visible: false })
		}
	}

	private scheduleScan(): void {
		if (this.scanTimeoutId !== undefined) {
			return
		}

		this.scanTimeoutId = setTimeout(() => {
			this.scanSelectors()
		}, 0)
	}

	private syncMutationObserver(): void {
		if (this.consumersBySelector.size > 0) {
			if (!this.observer) {
				this.observer = new MutationObserver((mutations) => {
					if (
						mutations.some(
							(mutation) =>
								mutation.type === 'childList' ||
								(mutation.type === 'attributes' && isElement(mutation.target)),
						)
					) {
						this.scheduleScan()
					}
				})

				this.observer.observe(document.documentElement, {
					attributes: true,
					childList: true,
					subtree: true,
				})
			}

			return
		}

		this.observer?.disconnect()
		this.observer = null
	}
}
