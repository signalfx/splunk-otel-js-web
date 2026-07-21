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

import { SplunkBlockingElementInstrumentation } from './splunk-blocking-element-instrumentation'

const SELECTOR = '.loading-spinner'
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
	let exporter: InMemorySpanExporter
	let provider: BasicTracerProvider
	let instrumentation: SplunkBlockingElementInstrumentation

	const getFinishedSpans = (): ReadableSpan[] => exporter.getFinishedSpans()

	beforeEach(() => {
		exporter = new InMemorySpanExporter()
		provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
	})

	afterEach(() => {
		instrumentation.disable()
		document.body.querySelectorAll(`.${TEST_ELEMENT_CLASS}`).forEach((element) => {
			element.remove()
		})
	})

	it('does not start any spans when disabled', () => {
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation({}, { spaMetrics: false })
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		expect(getFinishedSpans()).toHaveLength(0)
	})

	it('starts a span for a single element visible at enable() time', () => {
		const element = createVisibleElement()
		element.id = 'spinner-1'
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ instrumentations: { blockingElement: { enabled: true, selectors: [SELECTOR] } } },
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		expect(getFinishedSpans()).toHaveLength(0)
		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.openCount).toBe(1)
		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.has(SELECTOR, element)).toBe(true)
	})

	it('starts independent spans for two elements matching the same selector', () => {
		createVisibleElement()
		createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ instrumentations: { blockingElement: { enabled: true, selectors: [SELECTOR] } } },
		)
		instrumentation.setTracerProvider(provider)

		instrumentation.enable()

		// @ts-expect-error elementSpanTracker is private. We use it for testing.
		expect(instrumentation.elementSpanTracker.openCount).toBe(2)
	})

	it('completes the span for an element removed from the DOM', async () => {
		const element = createVisibleElement()
		instrumentation = new SplunkBlockingElementInstrumentation(
			{},
			{ instrumentations: { blockingElement: { enabled: true, selectors: [SELECTOR] } } },
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
			{ instrumentations: { blockingElement: { enabled: true, selectors: [SELECTOR] } } },
		)
		instrumentation.setTracerProvider(provider)
		instrumentation.enable()

		createVisibleElement()

		await vi.waitFor(() => {
			// @ts-expect-error elementSpanTracker is private. We use it for testing.
			expect(instrumentation.elementSpanTracker.openCount).toBe(1)
		})
	})
})
