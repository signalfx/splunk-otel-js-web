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

import {
	BasicTracerProvider,
	InMemorySpanExporter,
	type ReadableSpan,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ElementVisibilityObserver } from '../observers/element-visibility-observer'
import { SplunkBlockingElementInstrumentation } from './splunk-blocking-element-instrumentation'

const SELECTOR = '.loading-spinner'
const OTHER_SELECTOR = '[data-loading]'
const TEST_ELEMENT_CLASS = 'splunk-test-blocking-element'

const createVisibleElement = (): HTMLElement => {
	const element = document.createElement('div')
	element.className = `loading-spinner ${TEST_ELEMENT_CLASS}`
	element.style.height = '10px'
	element.style.width = '10px'
	document.body.append(element)
	return element
}

describe('SplunkBlockingElementInstrumentation', () => {
	let elementVisibilityObserver: ElementVisibilityObserver
	let exporter: InMemorySpanExporter
	let provider: BasicTracerProvider
	let instrumentation: SplunkBlockingElementInstrumentation | undefined

	const getFinishedSpans = (): ReadableSpan[] => exporter.getFinishedSpans()

	beforeEach(() => {
		exporter = new InMemorySpanExporter()
		provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
		elementVisibilityObserver = new ElementVisibilityObserver()
		instrumentation = undefined
	})

	afterEach(() => {
		instrumentation?.disable()
		document.body.querySelectorAll(`.${TEST_ELEMENT_CLASS}`).forEach((element) => {
			element.remove()
		})
	})

	it('throws a clear error when constructed without elementVisibilityObserver', () => {
		expect(
			() => new SplunkBlockingElementInstrumentation({}, { spaMetrics: false }, undefined, undefined, undefined),
		).toThrow('SplunkBlockingElementInstrumentation requires elementVisibilityObserver.')
	})

	it('does not start any spans when disabled', () => {
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: false },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		expect(getFinishedSpans()).toHaveLength(0)
	})

	it('starts spans when instrumentations.blockingElement.enabled overrides spaMetrics not otherwise enabling it', () => {
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{
				instrumentations: { blockingElement: { enabled: true } },
				spaMetrics: { blockingSelectors: [SELECTOR], monitors: ['network'] },
			},
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.openCount).toBe(1)
	})

	it('starts a span for a single element visible at enable() time', () => {
		const element = createVisibleElement()
		element.id = 'spinner-1'
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		expect(getFinishedSpans()).toHaveLength(0)
		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.openCount).toBe(1)
		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.has(element)).toBe(true)
	})

	it('starts independent spans for two elements matching the same selector', () => {
		createVisibleElement()
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.openCount).toBe(2)
	})

	it('starts exactly one span for an element matching two configured selectors', () => {
		const element = createVisibleElement()
		element.setAttribute('data-loading', '')
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: { blockingSelectors: [SELECTOR, OTHER_SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()
		instrumentation.disable()

		const finishedSpans = getFinishedSpans()
		expect(finishedSpans).toHaveLength(1)
		expect(finishedSpans[0].attributes['browser.element.selector']).toBe(`${SELECTOR},${OTHER_SELECTOR}`)
	})

	it('completes the span for an element removed from the DOM', async () => {
		const element = createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()

		element.remove()

		await vi.waitFor(() => {
			expect(getFinishedSpans()).toHaveLength(1)
		})
		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.completion']).toBe('completed')
	})

	it('tracks a dynamically added visible element after enable()', async () => {
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()

		createVisibleElement()

		await vi.waitFor(() => {
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(1)
		})
	})

	it('interrupts all open spans on disable, leaving none open', () => {
		createVisibleElement()
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()

		instrumentation.disable()

		const finishedSpans = getFinishedSpans()
		expect(finishedSpans).toHaveLength(2)
		expect(finishedSpans.every((span) => span.attributes['browser.element.completion'] === 'interrupted')).toBe(
			true,
		)
	})

	it('does not observe further DOM mutations after disable', async () => {
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ spaMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()
		instrumentation.disable()

		createVisibleElement()
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(getFinishedSpans()).toHaveLength(0)
	})
})