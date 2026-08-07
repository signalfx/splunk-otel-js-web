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
			() =>
				new SplunkBlockingElementInstrumentation(
					{},
					{ navigationMetrics: false },
					undefined,
					undefined,
					undefined,
				),
		).toThrow('SplunkBlockingElementInstrumentation requires elementVisibilityObserver.')
	})

	it('does not start any spans when disabled', () => {
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ navigationMetrics: false },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		expect(getFinishedSpans()).toHaveLength(0)
	})

	it('starts spans when instrumentations.blockingElement.enabled overrides navigationMetrics not otherwise enabling it', () => {
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{
				instrumentations: { blockingElement: { enabled: true } },
				navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['network'] },
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
			{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
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
			{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
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
		element.dataset.loading = ''
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ navigationMetrics: { blockingSelectors: [SELECTOR, OTHER_SELECTOR], monitors: ['elements'] } },
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

	it('keeps the span open when an element drops one of two matched selectors but still matches the other', async () => {
		const element = createVisibleElement()
		element.dataset.loading = ''
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ navigationMetrics: { blockingSelectors: [SELECTOR, OTHER_SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()

		await vi.waitFor(() => {
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(1)
		})

		// Drops OTHER_SELECTOR ([data-loading]) while remaining visible under SELECTOR (.loading-spinner).
		delete element.dataset.loading
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(getFinishedSpans()).toHaveLength(0)
		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.has(element)).toBe(true)

		// Now drops SELECTOR too, matching nothing configured — the span should finally complete.
		element.remove()

		await vi.waitFor(() => {
			expect(getFinishedSpans()).toHaveLength(1)
		})
		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.completion']).toBe('completed')
	})

	it('keeps one continuous span when an element swaps from one matched selector directly to another', async () => {
		const element = createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ navigationMetrics: { blockingSelectors: [SELECTOR, OTHER_SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()

		await vi.waitFor(() => {
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(1)
		})

		// One synchronous mutation: stops matching SELECTOR, starts matching OTHER_SELECTOR — the
		// element stays visible throughout, so this must not split into two spans.
		element.className = TEST_ELEMENT_CLASS
		element.dataset.loading = ''
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(getFinishedSpans()).toHaveLength(0)
		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.openCount).toBe(1)
		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.has(element)).toBe(true)

		element.remove()

		await vi.waitFor(() => {
			expect(getFinishedSpans()).toHaveLength(1)
		})
		const [span] = getFinishedSpans()
		expect(span.attributes['browser.element.completion']).toBe('completed')
		expect(span.attributes['browser.element.selector']).toBe(`${SELECTOR},${OTHER_SELECTOR}`)
	})

	it('does not open a second span for a still-visible element that already timed out, but does after it fully disappears and reappears', async () => {
		vi.useFakeTimers()
		try {
			const element = createVisibleElement()
			instrumentation = new SplunkBlockingElementInstrumentation(
				{},
				{
					instrumentations: { blockingElement: { maxElementSpanDuration: 5000 } },
					navigationMetrics: { blockingSelectors: [SELECTOR, OTHER_SELECTOR], monitors: ['elements'] },
				},
				undefined,
				undefined,
				elementVisibilityObserver,
			)
			instrumentation.setTracerProvider(provider)
			instrumentation.enable()

			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.has(element)).toBe(true)

			vi.advanceTimersByTime(5000)
			expect(getFinishedSpans()).toHaveLength(1)
			expect(getFinishedSpans()[0].attributes['browser.element.completion']).toBe('timeout')

			// Still visible, now also matches OTHER_SELECTOR — must not look like a brand-new element.
			element.dataset.loading = ''
			await vi.advanceTimersByTimeAsync(0)

			expect(getFinishedSpans()).toHaveLength(1)
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.has(element)).toBe(false)

			// Now genuinely disappears — a real episode boundary.
			element.remove()
			await vi.advanceTimersByTimeAsync(0)

			expect(getFinishedSpans()).toHaveLength(1)

			// Reappears — this is a new episode, so it must get a fresh span.
			document.body.append(element)
			await vi.advanceTimersByTimeAsync(0)

			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.has(element)).toBe(true)
		} finally {
			vi.useRealTimers()
		}
	})

	it('completes the span for an element removed from the DOM', async () => {
		const element = createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
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
			{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
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
			{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
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
			{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
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

	it('does not replace the tracker on a duplicate enable(), leaving the original span able to complete', async () => {
		const element = createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
			undefined,
			undefined,
			elementVisibilityObserver,
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()

		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		const trackerAfterFirstEnable = instrumentation.elementSpanTracker

		instrumentation.enable()

		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker).toBe(trackerAfterFirstEnable)

		element.remove()

		await vi.waitFor(() => {
			expect(getFinishedSpans()).toHaveLength(1)
		})
		expect(getFinishedSpans()[0].attributes['browser.element.completion']).toBe('completed')
	})

	describe('pagehide', () => {
		it('interrupts open spans on pagehide without unwatching the shared observer', async () => {
			const element = createVisibleElement()
			instrumentation = new SplunkBlockingElementInstrumentation(
				{},
				{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
				undefined,
				undefined,
				elementVisibilityObserver,
			)
			instrumentation.setTracerProvider(provider)
			instrumentation.enable()

			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.has(element)).toBe(true)

			window.dispatchEvent(new Event('pagehide'))

			const finishedSpans = getFinishedSpans()
			expect(finishedSpans).toHaveLength(1)
			expect(finishedSpans[0].attributes['browser.element.completion']).toBe('interrupted')

			// The observer subscription must survive pagehide (unlike disable()), so a subsequent
			// mutation on the still-live page still gets tracked — e.g. a bfcache-restored page.
			createVisibleElement()
			await vi.waitFor(() => {
				// @ts-expect-error elementSpanTracker is private. We use it for testing.
				expect(instrumentation.elementSpanTracker.openCount).toBe(1)
			})
		})

		it('does not act on pagehide once disabled', () => {
			createVisibleElement()
			instrumentation = new SplunkBlockingElementInstrumentation(
				{},
				{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
				undefined,
				undefined,
				elementVisibilityObserver,
			)
			instrumentation.setTracerProvider(provider)
			instrumentation.enable()
			instrumentation.disable()

			// disable() already interrupted the one open span; a later pagehide must not throw or
			// produce a second span for the same (already-untracked) element.
			expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow()
			expect(getFinishedSpans()).toHaveLength(1)
		})

		it('interrupts again on a second pagehide after a bfcache restore, not just the first', async () => {
			instrumentation = new SplunkBlockingElementInstrumentation(
				{},
				{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
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

			window.dispatchEvent(new Event('pagehide'))
			expect(getFinishedSpans()).toHaveLength(1)

			// Simulate a bfcache restore: page resumes, a new spinner appears, then the page is hidden
			// again. With `once: true` this second pagehide would never fire at all.
			window.dispatchEvent(new Event('pageshow'))
			createVisibleElement()
			await vi.waitFor(() => {
				// @ts-expect-error elementSpanTracker is private. We use it for testing.
				expect(instrumentation.elementSpanTracker.openCount).toBe(1)
			})

			window.dispatchEvent(new Event('pagehide'))

			const finishedSpans = getFinishedSpans()
			expect(finishedSpans).toHaveLength(2)
			expect(finishedSpans.every((span) => span.attributes['browser.element.completion'] === 'interrupted')).toBe(
				true,
			)
		})

		it('resyncs and reopens a span on pageshow after a bfcache restore for an element still visible throughout', () => {
			const element = createVisibleElement()
			instrumentation = new SplunkBlockingElementInstrumentation(
				{},
				{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
				undefined,
				undefined,
				elementVisibilityObserver,
			)
			instrumentation.setTracerProvider(provider)
			instrumentation.enable()

			window.dispatchEvent(new Event('pagehide'))
			expect(getFinishedSpans()).toHaveLength(1)
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(0)

			// The element never left the DOM across the freeze — no mutation for the observer to
			// naturally rediscover it. Only a persisted pageshow should trigger a resync.
			window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))

			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(1)
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.has(element)).toBe(true)
		})

		it('does not resync on a non-persisted pageshow', () => {
			createVisibleElement()
			instrumentation = new SplunkBlockingElementInstrumentation(
				{},
				{ navigationMetrics: { blockingSelectors: [SELECTOR], monitors: ['elements'] } },
				undefined,
				undefined,
				elementVisibilityObserver,
			)
			instrumentation.setTracerProvider(provider)
			instrumentation.enable()

			window.dispatchEvent(new Event('pagehide'))
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(0)

			window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))

			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(0)
		})
	})
})
