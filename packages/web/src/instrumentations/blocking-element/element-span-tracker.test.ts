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

import { hrTimeToMilliseconds } from '@opentelemetry/core'
import {
	BasicTracerProvider,
	InMemorySpanExporter,
	type ReadableSpan,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ElementSpanTracker } from './element-span-tracker'

const SELECTOR = '.loading-spinner'
const OTHER_SELECTOR = '[data-loading]'
// Large enough that no test below triggers it by accident; timeout-specific tests pass their own.
const DEFAULT_TEST_MAX_ELEMENT_SPAN_DURATION = 60_000

const createElement = (options: { className?: string; id?: string } = {}): HTMLElement => {
	const element = document.createElement('div')
	element.id = options.id ?? ''
	element.className = options.className ?? ''
	return element
}

describe('ElementSpanTracker', () => {
	let exporter: InMemorySpanExporter
	let provider: BasicTracerProvider

	const getFinishedSpans = (): ReadableSpan[] => exporter.getFinishedSpans()

	const createTracker = (
		configuredSelectors: string[] = [SELECTOR, OTHER_SELECTOR],
		maxElementSpanDuration: number = DEFAULT_TEST_MAX_ELEMENT_SPAN_DURATION,
	): ElementSpanTracker =>
		new ElementSpanTracker(provider.getTracer('test'), configuredSelectors, maxElementSpanDuration)

	beforeEach(() => {
		exporter = new InMemorySpanExporter()
		provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
	})

	it('creates a root span with component and element attributes', () => {
		const tracker = createTracker()
		const element = createElement({ className: 'loading-spinner', id: 'main-spinner' })

		tracker.startSpan(element, [SELECTOR], performance.now())
		tracker.completeSpan(element, performance.now())

		const [span] = getFinishedSpans()
		expect(span.name).toBe('blockingElement')
		expect(span.parentSpanId).toBeUndefined()
		expect(span.attributes.component).toBe('splunk-blocking-element')
		expect(span.attributes['browser.element.selector']).toBe(SELECTOR)
		expect(span.attributes['browser.element.id']).toBe('main-spinner')
		expect(span.attributes['browser.element.class']).toBe('loading-spinner')
		expect(span.attributes['browser.element.tag']).toBe('DIV')
		expect(span.attributes['browser.element.xpath']).toBe('//*[@id="main-spinner"]')
	})

	it('no-ops the span on a duplicate startSpan for the same element', () => {
		const tracker = createTracker()
		const element = createElement()

		tracker.startSpan(element, [SELECTOR], performance.now())
		tracker.startSpan(element, [SELECTOR], performance.now())

		expect(tracker.openCount).toBe(1)
	})

	it('starts independent spans for two elements matching the same selector', () => {
		const tracker = createTracker()
		const first = createElement()
		const second = createElement()

		tracker.startSpan(first, [SELECTOR], performance.now())
		tracker.startSpan(second, [SELECTOR], performance.now())

		expect(tracker.openCount).toBe(2)
		expect(tracker.has(first)).toBe(true)
		expect(tracker.has(second)).toBe(true)
	})

	it('completes a span with completion="completed" and the correct duration', () => {
		const tracker = createTracker()
		const element = createElement()
		const startTime = 1000
		const endTime = 1250

		tracker.startSpan(element, [SELECTOR], startTime)
		tracker.completeSpan(element, endTime)

		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.completion']).toBe('completed')
		expect(hrTimeToMilliseconds(span.duration)).toBeCloseTo(250, 0)
		expect(tracker.has(element)).toBe(false)
		expect(tracker.openCount).toBe(0)
	})

	it('no-ops completeSpan for an element that was never started', () => {
		const tracker = createTracker()
		const element = createElement()

		tracker.completeSpan(element, performance.now())

		expect(getFinishedSpans()).toHaveLength(0)
	})

	it('interrupts a single span with completion="interrupted"', () => {
		const tracker = createTracker()
		const element = createElement()

		tracker.startSpan(element, [SELECTOR], performance.now())
		tracker.interruptSpan(element)

		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.completion']).toBe('interrupted')
		expect(tracker.has(element)).toBe(false)
	})

	it('interrupts every open span across all selectors', () => {
		const tracker = createTracker()
		const first = createElement()
		const other = createElement()

		tracker.startSpan(first, [SELECTOR], performance.now())
		tracker.startSpan(other, [OTHER_SELECTOR], performance.now())

		tracker.interruptAll()

		const finishedSpans = getFinishedSpans()
		expect(finishedSpans).toHaveLength(2)
		expect(finishedSpans.every((span) => span.attributes['browser.element.completion'] === 'interrupted')).toBe(
			true,
		)
		expect(tracker.openCount).toBe(0)
	})

	it('returns the currently tracked elements', () => {
		const tracker = createTracker()
		const first = createElement()
		const second = createElement()

		tracker.startSpan(first, [SELECTOR], performance.now())
		tracker.startSpan(second, [OTHER_SELECTOR], performance.now())

		expect(tracker.trackedElements()).toEqual([first, second])
	})

	it('returns an empty array when nothing is tracked', () => {
		const tracker = createTracker()

		expect(tracker.trackedElements()).toEqual([])
	})

	it('reads a live SVGAnimatedString className via animVal', () => {
		const tracker = createTracker()
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		svg.setAttribute('class', 'loading-spinner')
		expect(typeof svg.className).toBe('object')

		tracker.startSpan(svg, [SELECTOR], performance.now())
		tracker.completeSpan(svg, performance.now())

		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.class']).toBe('loading-spinner')
	})

	describe('multi-selector consolidation', () => {
		it('creates one span, not two, for an element matching two configured selectors at open time', () => {
			const tracker = createTracker()
			const element = createElement()

			tracker.startSpan(element, [SELECTOR, OTHER_SELECTOR], performance.now())

			expect(tracker.openCount).toBe(1)
		})

		it('joins matched selectors in configured order, not the order they were observed', () => {
			const tracker = createTracker([SELECTOR, OTHER_SELECTOR])
			const element = createElement()

			// Observed in reverse of configured order.
			tracker.startSpan(element, [OTHER_SELECTOR, SELECTOR], performance.now())
			tracker.completeSpan(element, performance.now())

			const [span] = getFinishedSpans()
			expect(span.attributes['browser.element.selector']).toBe(`${SELECTOR},${OTHER_SELECTOR}`)
		})

		it('accumulates a selector gained mid-span into the final completion attribute', () => {
			const tracker = createTracker()
			const element = createElement()

			tracker.startSpan(element, [SELECTOR], performance.now())
			// Later scan: element now also matches OTHER_SELECTOR while still open.
			tracker.startSpan(element, [OTHER_SELECTOR], performance.now())
			tracker.completeSpan(element, performance.now())

			const [span] = getFinishedSpans()
			expect(span.attributes['browser.element.selector']).toBe(`${SELECTOR},${OTHER_SELECTOR}`)
		})

		it('keeps a previously matched selector in the final attribute even after the element stops matching it', () => {
			const tracker = createTracker()
			const element = createElement()

			tracker.startSpan(element, [SELECTOR, OTHER_SELECTOR], performance.now())
			// Later scan: element now only matches SELECTOR, but the span stays open (caller's job,
			// not the tracker's — completeSpan is only called when the caller decides nothing matches).
			tracker.startSpan(element, [SELECTOR], performance.now())
			tracker.completeSpan(element, performance.now())

			const [span] = getFinishedSpans()
			expect(span.attributes['browser.element.selector']).toBe(`${SELECTOR},${OTHER_SELECTOR}`)
		})
	})

	describe('MAX_OPEN_ELEMENT_SPANS cap', () => {
		it('drops the span past the cap without incrementing openCount', () => {
			const tracker = createTracker()

			for (let index = 0; index < 1000; index += 1) {
				tracker.startSpan(createElement(), [SELECTOR], performance.now())
			}

			expect(tracker.openCount).toBe(1000)

			tracker.startSpan(createElement(), [SELECTOR], performance.now())

			expect(tracker.openCount).toBe(1000)
			expect(getFinishedSpans()).toHaveLength(0)
		})

		it('does not count a re-entrant startSpan for an already-tracked element against the cap', () => {
			const tracker = createTracker()
			const elements: HTMLElement[] = []

			for (let index = 0; index < 1000; index += 1) {
				const element = createElement()
				elements.push(element)
				tracker.startSpan(element, [SELECTOR], performance.now())
			}

			// Re-matching an already-tracked element must not be treated as a new element.
			tracker.startSpan(elements[0], [SELECTOR, OTHER_SELECTOR], performance.now())

			expect(tracker.openCount).toBe(1000)
		})
	})

	describe('maxElementSpanDuration timeout', () => {
		afterEach(() => {
			vi.useRealTimers()
		})

		it('ends a span with completion="timeout" once maxElementSpanDuration elapses', () => {
			vi.useFakeTimers()
			const tracker = createTracker([SELECTOR, OTHER_SELECTOR], 5000)
			const element = createElement()

			tracker.startSpan(element, [SELECTOR], performance.now())
			vi.advanceTimersByTime(5000)

			const [span] = getFinishedSpans()
			expect(span.attributes['browser.element.completion']).toBe('timeout')
			expect(tracker.has(element)).toBe(false)
			expect(tracker.openCount).toBe(0)
		})

		it('does not time out a span that completes before maxElementSpanDuration elapses', () => {
			vi.useFakeTimers()
			const tracker = createTracker([SELECTOR, OTHER_SELECTOR], 5000)
			const element = createElement()

			tracker.startSpan(element, [SELECTOR], performance.now())
			vi.advanceTimersByTime(1000)
			tracker.completeSpan(element, performance.now())
			vi.advanceTimersByTime(5000)

			const finishedSpans = getFinishedSpans()
			expect(finishedSpans).toHaveLength(1)
			expect(finishedSpans[0].attributes['browser.element.completion']).toBe('completed')
		})

		it('does not time out a span that is interrupted before maxElementSpanDuration elapses', () => {
			vi.useFakeTimers()
			const tracker = createTracker([SELECTOR, OTHER_SELECTOR], 5000)
			const element = createElement()

			tracker.startSpan(element, [SELECTOR], performance.now())
			vi.advanceTimersByTime(1000)
			tracker.interruptSpan(element)
			vi.advanceTimersByTime(5000)

			const finishedSpans = getFinishedSpans()
			expect(finishedSpans).toHaveLength(1)
			expect(finishedSpans[0].attributes['browser.element.completion']).toBe('interrupted')
		})
	})
})
