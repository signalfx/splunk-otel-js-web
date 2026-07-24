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

	/** Replaces a consumer's watched selector list entirely: drops what's no longer included, adds what's new. */
	watch(consumerId: symbol, selectors: string[], onChange: ElementVisibilityCallback): void {
		this.callbacks.set(consumerId, onChange)

		const nextSelectors = new Set(selectors)
		for (const [selector, consumers] of this.consumersBySelector) {
			// This consumer was watching selector before, but the new list no longer includes it.
			if (consumers.has(consumerId) && !nextSelectors.has(selector)) {
				this.dropConsumerFromSelector(consumerId, selector, onChange)
			}
		}

		// No-ops if already watching; otherwise scans fresh, even if another consumer already tracks it.
		for (const selector of nextSelectors) {
			this.addConsumerToSelector(consumerId, selector)
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

	/**
	 * Removes consumerId from selector's watchers and, if it was previously watching a currently
	 * visible element under that selector, emits one final `visible: false` event for it so the
	 * dropping consumer can tear its own state down without needing to re-scan.
	 */
	private dropConsumerFromAllSelectors(consumerId: symbol, onChange: ElementVisibilityCallback): void {
		for (const selector of [...this.consumersBySelector.keys()]) {
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

	private isElementVisible(element: Element): boolean {
		if (!element.isConnected || element.hasAttribute('hidden') || element.getClientRects().length === 0) {
			return false
		}

		const style = getComputedStyle(element)
		return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
	}

	/**
	 * joiningConsumerId, if given, gets full current-state visible:true events for every currently
	 * visible element (it has no prior state to diff against) and is excluded from the ordinary
	 * delta notification below, so it never gets double-notified for elements that are both
	 * already-visible and part of this scan's true delta.
	 */
	private scanSelector(selector: string, joiningConsumerId?: symbol): void {
		const previouslyVisible = this.visibleElementsBySelector.get(selector) ?? new Set<Element>()
		const currentlyVisible = this.getVisibleMatches(selector)
		this.visibleElementsBySelector.set(selector, currentlyVisible)

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

		// Notify consumers of new elements that are visible now but weren't before.
		for (const element of currentlyVisible) {
			if (!previouslyVisible.has(element)) {
				this.notify(deltaConsumers, { element, selector, visible: true })
			}
		}

		// Notify consumers of old elements that were visible before but now aren't.
		for (const element of previouslyVisible) {
			if (!currentlyVisible.has(element)) {
				this.notify(deltaConsumers, { element, selector, visible: false })
			}
		}
	}

	private scanSelectors(): void {
		this.clearScheduledScan()

		for (const selector of [...this.consumersBySelector.keys()]) {
			this.scanSelector(selector)
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

	/** Isolates one consumer's callback so a thrown error can't stop other consumers from being notified. */
	private invokeCallback(consumerId: symbol, event: ElementVisibilityChangeEvent): void {
		try {
			this.callbacks.get(consumerId)?.(event)
		} catch (error) {
			diag.warn('ElementVisibilityObserver: Consumer callback threw.', { error })
		}
	}

	private notify(consumers: Set<symbol>, event: ElementVisibilityChangeEvent): void {
		for (const consumerId of consumers) {
			this.invokeCallback(consumerId, event)
		}
	}

	private syncMutationObserver(): void {
		if (this.consumersBySelector.size > 0) {
			if (!this.observer) {
				this.observer = new MutationObserver((mutations) => {
					if (
						mutations.some(
							(mutation) =>
								mutation.type === 'childList' || (mutation.type === 'attributes' && isElement(mutation.target)),
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
