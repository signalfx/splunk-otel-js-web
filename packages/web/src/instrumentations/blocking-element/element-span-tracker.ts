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

import type { Span, Tracer } from '@opentelemetry/api'

import {
	BLOCKING_ELEMENT_SPAN_NAME,
	BROWSER_ELEMENT_CLASS_ATTRIBUTE,
	BROWSER_ELEMENT_COMPLETION_ATTRIBUTE,
	BROWSER_ELEMENT_COMPLETION_COMPLETED,
	BROWSER_ELEMENT_COMPLETION_INTERRUPTED,
	BROWSER_ELEMENT_ID_ATTRIBUTE,
	BROWSER_ELEMENT_SELECTOR_ATTRIBUTE,
	BROWSER_ELEMENT_TAG_ATTRIBUTE,
} from './constants'

/** `SVGElement.className` is an `SVGAnimatedString` at runtime; `animVal` gives the live value. */
function getElementClass(element: Element): string {
	const className = element.className as unknown as string | SVGAnimatedString
	return typeof className === 'string' ? className : className.animVal ?? ''
}

/**
 * Creates one span per (selector, element) pair matching a configured blocking selector.
 * Kept fully independent of LoadingElementMonitor's own PCT tracking: this class only reacts
 * to element-level start/complete/interrupt calls it is given and never reads or mutates PCT
 * state.
 */
export class ElementSpanTracker {
	private readonly spansBySelector = new Map<string, Map<Element, Span>>()

	constructor(private readonly tracer: Tracer) {}

	completeSpan(selector: string, element: Element, endTimeRelative: number): void {
		const span = this.spansBySelector.get(selector)?.get(element)
		if (!span) {
			return
		}

		this.spansBySelector.get(selector)?.delete(element)
		span.setAttribute(BROWSER_ELEMENT_COMPLETION_ATTRIBUTE, BROWSER_ELEMENT_COMPLETION_COMPLETED)
		span.end(endTimeRelative)
	}

	has(selector: string, element: Element): boolean {
		return this.spansBySelector.get(selector)?.has(element) ?? false
	}

	interruptAll(): void {
		for (const selector of this.spansBySelector.keys()) {
			this.interruptAllForSelector(selector)
		}
	}

	/**
	 * No caller in this instrumentation's v1 scope. Kept as the seam a future per-route
	 * selector re-resolution ticket would call for each selector that falls out of a newly
	 * resolved list (same pattern as LoadingElementMonitor's setSelectors -> completeSelector).
	 */
	interruptAllForSelector(selector: string): void {
		const elements = this.spansBySelector.get(selector)
		if (!elements) {
			return
		}

		for (const element of elements.keys()) {
			this.interruptSpan(selector, element)
		}
	}

	interruptSpan(selector: string, element: Element): void {
		const span = this.spansBySelector.get(selector)?.get(element)
		if (!span) {
			return
		}

		this.spansBySelector.get(selector)?.delete(element)
		span.setAttribute(BROWSER_ELEMENT_COMPLETION_ATTRIBUTE, BROWSER_ELEMENT_COMPLETION_INTERRUPTED)
		span.end()
	}

	/**
	 * Total number of currently open (not yet ended) element spans across all selectors.
	 * Exposed so a future volume cap can be added as a single guard clause in startSpan
	 * without needing new plumbing.
	 */
	get openCount(): number {
		let count = 0
		for (const elements of this.spansBySelector.values()) {
			count += elements.size
		}

		return count
	}

	startSpan(selector: string, element: Element, startTimeRelative: number): void {
		if (this.has(selector, element)) {
			return
		}

		const span = this.tracer.startSpan(BLOCKING_ELEMENT_SPAN_NAME, {
			root: true,
			startTime: startTimeRelative,
		})
		span.setAttribute('component', BLOCKING_ELEMENT_SPAN_NAME)
		span.setAttribute(BROWSER_ELEMENT_SELECTOR_ATTRIBUTE, selector)
		span.setAttribute(BROWSER_ELEMENT_ID_ATTRIBUTE, element.id)
		span.setAttribute(BROWSER_ELEMENT_CLASS_ATTRIBUTE, getElementClass(element))
		span.setAttribute(BROWSER_ELEMENT_TAG_ATTRIBUTE, element.tagName)

		if (!this.spansBySelector.has(selector)) {
			this.spansBySelector.set(selector, new Map())
		}

		this.spansBySelector.get(selector)?.set(element, span)
	}
}