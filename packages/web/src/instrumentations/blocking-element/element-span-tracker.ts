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

import { diag, type Span, type Tracer } from '@opentelemetry/api'

import { getElementXPath } from '../../utils/xpath'
import {
	BLOCKING_ELEMENT_SPAN_NAME,
	BROWSER_ELEMENT_CLASS_ATTRIBUTE,
	BROWSER_ELEMENT_COMPLETION_ATTRIBUTE,
	BROWSER_ELEMENT_COMPLETION_COMPLETED,
	BROWSER_ELEMENT_COMPLETION_INTERRUPTED,
	BROWSER_ELEMENT_ID_ATTRIBUTE,
	BROWSER_ELEMENT_SELECTOR_ATTRIBUTE,
	BROWSER_ELEMENT_TAG_ATTRIBUTE,
	BROWSER_ELEMENT_XPATH_ATTRIBUTE,
	MAX_OPEN_ELEMENT_SPANS,
} from './constants'

type TrackedElement = {
	accumulatedSelectors: Set<string>
	span: Span
}

/** `SVGElement.className` is an `SVGAnimatedString` at runtime; `animVal` gives the live value. */
function getElementClass(element: Element): string {
	const className = element.className as unknown as string | SVGAnimatedString
	return typeof className === 'string' ? className : (className.animVal ?? '')
}

/**
 * Creates one span per DOM element matching any configured blocking selector, regardless of how
 * many configured selectors it matches. 
 */
export class ElementSpanTracker {
	private hasWarnedAtCapacity = false

	private readonly tracked = new Map<Element, TrackedElement>()

	/**
	 * The configured selector list, in configuration order. Used only to join
	 * `accumulatedSelectors` deterministically at completion time — `Set` iteration order reflects
	 * insertion order, not configuration order, so it cannot be used directly for the exported
	 * attribute.
	 */
	constructor(
		private readonly tracer: Tracer,
		private readonly configuredSelectors: string[],
	) {}

	completeSpan(element: Element, endTimeRelative: number): void {
		this.endSpan(element, BROWSER_ELEMENT_COMPLETION_COMPLETED, endTimeRelative)
	}

	has(element: Element): boolean {
		return this.tracked.has(element)
	}

	interruptAll(): void {
		for (const element of this.trackedElements()) {
			this.interruptSpan(element)
		}
	}

	/**
	 * Interrupts every open span whose element currently matches the given selector. No caller in
	 * this instrumentation's v1 scope — kept as the seam a future per-route selector re-resolution
	 * ticket would call for each selector that falls out of a newly resolved list.
	 */
	interruptAllForSelector(selector: string): void {
		for (const element of this.trackedElements()) {
			if (this.tracked.get(element)?.accumulatedSelectors.has(selector)) {
				this.interruptSpan(element)
			}
		}
	}

	interruptSpan(element: Element): void {
		this.endSpan(element, BROWSER_ELEMENT_COMPLETION_INTERRUPTED)
	}

	/** Total number of currently open (not yet ended) element spans, one per physical element. */
	get openCount(): number {
		return this.tracked.size
	}

	/**
	 * matchedSelectors is every currently-configured selector this element matches right now
	 * (config order). Merged into the element's accumulated set on every call, including for
	 * already-tracked elements — a no-op on the Span itself, but keeps the eventual completion
	 * attribute current.
	 */
	startSpan(element: Element, matchedSelectors: string[], startTimeRelative: number): void {
		const existing = this.tracked.get(element)
		if (existing) {
			for (const selector of matchedSelectors) {
				existing.accumulatedSelectors.add(selector)
			}

			return
		}

		if (this.tracked.size >= MAX_OPEN_ELEMENT_SPANS) {
			if (!this.hasWarnedAtCapacity) {
				this.hasWarnedAtCapacity = true
				diag.warn('ElementSpanTracker: Reached max open element spans; dropping further elements.', {
					max: MAX_OPEN_ELEMENT_SPANS,
				})
			}

			return
		}

		const span = this.tracer.startSpan(BLOCKING_ELEMENT_SPAN_NAME, {
			root: true,
			startTime: startTimeRelative,
		})
		span.setAttribute('component', BLOCKING_ELEMENT_SPAN_NAME)
		span.setAttribute(BROWSER_ELEMENT_ID_ATTRIBUTE, element.id)
		span.setAttribute(BROWSER_ELEMENT_CLASS_ATTRIBUTE, getElementClass(element))
		span.setAttribute(BROWSER_ELEMENT_TAG_ATTRIBUTE, element.tagName)
		span.setAttribute(BROWSER_ELEMENT_XPATH_ATTRIBUTE, getElementXPath(element, true))

		this.tracked.set(element, { accumulatedSelectors: new Set(matchedSelectors), span })
	}

	/** Snapshot of currently tracked elements, safe to iterate while mutating the map. */
	trackedElements(): Element[] {
		return Array.from(this.tracked.keys())
	}

	private endSpan(element: Element, completion: string, endTimeRelative?: number): void {
		const tracked = this.tracked.get(element)
		if (!tracked) {
			return
		}

		this.tracked.delete(element)

		const selectorValue = this.configuredSelectors
			.filter((selector) => tracked.accumulatedSelectors.has(selector))
			.join(',')
		tracked.span.setAttribute(BROWSER_ELEMENT_SELECTOR_ATTRIBUTE, selectorValue)
		tracked.span.setAttribute(BROWSER_ELEMENT_COMPLETION_ATTRIBUTE, completion)
		tracked.span.end(endTimeRelative)
	}
}