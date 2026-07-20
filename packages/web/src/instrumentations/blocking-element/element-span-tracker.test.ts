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
import { BasicTracerProvider, InMemorySpanExporter, type ReadableSpan, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { beforeEach, describe, expect, it } from 'vitest'

import { ElementSpanTracker } from './element-span-tracker'

const SELECTOR = '.loading-spinner'

const createElement = (options: { className?: string; id?: string } = {}): HTMLElement => {
	const element = document.createElement('div')
	element.id = options.id ?? ''
	element.className = options.className ?? ''
	return element
}

describe('ElementSpanTracker', () => {
	let exporter: InMemorySpanExporter
	let provider: BasicTracerProvider
	let tracker: ElementSpanTracker

	const getFinishedSpans = (): ReadableSpan[] => exporter.getFinishedSpans()

	beforeEach(() => {
		exporter = new InMemorySpanExporter()
		provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
		tracker = new ElementSpanTracker(provider.getTracer('test'))
	})

	it('creates a root span with component and element attributes', () => {
		const element = createElement({ className: 'loading-spinner', id: 'main-spinner' })

		tracker.startSpan(SELECTOR, element, performance.now())
		tracker.completeSpan(SELECTOR, element, performance.now())

		const [span] = getFinishedSpans()
		expect(span.name).toBe('blockingElement')
		expect(span.parentSpanId).toBeUndefined()
		expect(span.attributes.component).toBe('blockingElement')
		expect(span.attributes['browser.element.selector']).toBe(SELECTOR)
		expect(span.attributes['browser.element.id']).toBe('main-spinner')
		expect(span.attributes['browser.element.class']).toBe('loading-spinner')
		expect(span.attributes['browser.element.tag']).toBe('DIV')
	})

	it('no-ops on a duplicate startSpan for the same selector and element', () => {
		const element = createElement()

		tracker.startSpan(SELECTOR, element, performance.now())
		tracker.startSpan(SELECTOR, element, performance.now())

		expect(tracker.openCount).toBe(1)
	})

	it('starts independent spans for two elements matching the same selector', () => {
		const first = createElement()
		const second = createElement()

		tracker.startSpan(SELECTOR, first, performance.now())
		tracker.startSpan(SELECTOR, second, performance.now())

		expect(tracker.openCount).toBe(2)
		expect(tracker.has(SELECTOR, first)).toBe(true)
		expect(tracker.has(SELECTOR, second)).toBe(true)
	})

	it('completes a span with completion="completed" and the correct duration', () => {
		const element = createElement()
		const startTime = 1000
		const endTime = 1250

		tracker.startSpan(SELECTOR, element, startTime)
		tracker.completeSpan(SELECTOR, element, endTime)

		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.completion']).toBe('completed')
		expect(hrTimeToMilliseconds(span.duration)).toBeCloseTo(250, 0)
		expect(tracker.has(SELECTOR, element)).toBe(false)
		expect(tracker.openCount).toBe(0)
	})

	it('no-ops completeSpan for an element that was never started', () => {
		const element = createElement()

		tracker.completeSpan(SELECTOR, element, performance.now())

		expect(getFinishedSpans()).toHaveLength(0)
	})

	it('interrupts a single span with completion="interrupted"', () => {
		const element = createElement()

		tracker.startSpan(SELECTOR, element, performance.now())
		tracker.interruptSpan(SELECTOR, element)

		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.completion']).toBe('interrupted')
		expect(tracker.has(SELECTOR, element)).toBe(false)
	})

	it('interrupts all spans for a given selector, leaving other selectors untouched', () => {
		const otherSelector = '.other-spinner'
		const first = createElement()
		const second = createElement()
		const other = createElement()

		tracker.startSpan(SELECTOR, first, performance.now())
		tracker.startSpan(SELECTOR, second, performance.now())
		tracker.startSpan(otherSelector, other, performance.now())

		tracker.interruptAllForSelector(SELECTOR)

		const finishedSpans = getFinishedSpans()
		expect(finishedSpans).toHaveLength(2)
		expect(finishedSpans.every((span) => span.attributes['browser.element.completion'] === 'interrupted')).toBe(true)
		expect(tracker.openCount).toBe(1)
		expect(tracker.has(otherSelector, other)).toBe(true)
	})

	it('interrupts every open span across all selectors', () => {
		const otherSelector = '.other-spinner'
		const first = createElement()
		const other = createElement()

		tracker.startSpan(SELECTOR, first, performance.now())
		tracker.startSpan(otherSelector, other, performance.now())

		tracker.interruptAll()

		const finishedSpans = getFinishedSpans()
		expect(finishedSpans).toHaveLength(2)
		expect(finishedSpans.every((span) => span.attributes['browser.element.completion'] === 'interrupted')).toBe(true)
		expect(tracker.openCount).toBe(0)
	})

	it('reads a live SVGAnimatedString className via animVal', () => {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		expect(typeof svg.className).toBe('object')

		tracker.startSpan(SELECTOR, svg, performance.now())

		expect(tracker.has(SELECTOR, svg)).toBe(true)
	})
})