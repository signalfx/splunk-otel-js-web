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
	BLOCKING_ELEMENT_MODULE_NAME,
	BLOCKING_ELEMENT_SPAN_NAME,
	BROWSER_ELEMENT_CLASS_ATTRIBUTE,
	BROWSER_ELEMENT_COMPLETION_ATTRIBUTE,
	BROWSER_ELEMENT_COMPLETION_COMPLETED,
	BROWSER_ELEMENT_COMPLETION_TIMEOUT,
	BROWSER_ELEMENT_ID_ATTRIBUTE,
	BROWSER_ELEMENT_SELECTOR_ATTRIBUTE,
	BROWSER_ELEMENT_TAG_ATTRIBUTE,
	BROWSER_ELEMENT_XPATH_ATTRIBUTE,
	MAX_OPEN_ELEMENT_SPANS,
} from './constants'

type TrackedElement = {
	accumulatedSelectors: Set<string>
	span: Span
	timeoutId: ReturnType<typeof setTimeout>
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
	 * maxElementSpanDuration bounds how long any single element span can stay open — without it, an
	 * element that never disappears (and is never interrupted via disable()/pagehide) would produce
	 * no telemetry at all, the one case a duration-measuring feature can least afford to miss.
	 *
	 * onSpanTimeout fires only when the timer itself ends a span, not for caller-initiated
	 * completeSpan/interruptSpan — lets the caller avoid opening a second span for the same
	 * still-visible element.
	 */
	constructor(
		private readonly tracer: Tracer,
		private readonly maxElementSpanDuration: number,
		private readonly onSpanTimeout?: (element: Element) => void,
	) {}

	completeSpan(element: Element, endTimeRelative: number): void {
		this.endSpan(element, BROWSER_ELEMENT_COMPLETION_COMPLETED, endTimeRelative)
	}

	has(element: Element): boolean {
		return this.tracked.has(element)
	}

	interruptAll(completion: string): void {
		for (const element of this.trackedElements()) {
			this.interruptSpan(element, completion)
		}
	}

	interruptSpan(element: Element, completion: string): void {
		this.endSpan(element, completion)
	}

	/** Total number of currently open (not yet ended) element spans, one per physical element. */
	get openCount(): number {
		return this.tracked.size
	}

	/**
	 * matchedSelectors is every currently-configured selector this element matches right now.
	 * Merged into the element's accumulated set on every call, including for already-tracked
	 * elements — a no-op on the Span itself, but keeps the eventual completion attribute current.
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
		span.setAttribute('component', BLOCKING_ELEMENT_MODULE_NAME)
		span.setAttribute(BROWSER_ELEMENT_ID_ATTRIBUTE, element.id)
		span.setAttribute(BROWSER_ELEMENT_CLASS_ATTRIBUTE, getElementClass(element))
		span.setAttribute(BROWSER_ELEMENT_TAG_ATTRIBUTE, element.tagName)
		span.setAttribute(BROWSER_ELEMENT_XPATH_ATTRIBUTE, getElementXPath(element, true))

		const timeoutId = setTimeout(() => {
			this.endSpan(element, BROWSER_ELEMENT_COMPLETION_TIMEOUT, performance.now())
			this.onSpanTimeout?.(element)
		}, this.maxElementSpanDuration)

		this.tracked.set(element, { accumulatedSelectors: new Set(matchedSelectors), span, timeoutId })
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

		clearTimeout(tracked.timeoutId)
		this.tracked.delete(element)

		// Set iteration order is insertion order — i.e. the order the element first matched each
		// selector, not configuration order. Selectors dropped by a later config change (e.g. a
		// urlOverride) stay in this list; accumulatedSelectors only ever grows for an open span.
		const selectorValue = [...tracked.accumulatedSelectors].join(',')
		tracked.span.setAttribute(BROWSER_ELEMENT_SELECTOR_ATTRIBUTE, selectorValue)
		tracked.span.setAttribute(BROWSER_ELEMENT_COMPLETION_ATTRIBUTE, completion)
		tracked.span.end(endTimeRelative)
	}
}
