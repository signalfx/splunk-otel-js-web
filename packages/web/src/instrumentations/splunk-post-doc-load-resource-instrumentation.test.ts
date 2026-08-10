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

import { context, ROOT_CONTEXT, type Span } from '@opentelemetry/api'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { markResourceHandledByDocumentLoad } from './resource-span-dedupe'
import {
	SplunkPostDocLoadResourceInstrumentation,
	type SplunkPostDocLoadResourceInstrumentationConfig,
} from './splunk-post-doc-load-resource-instrumentation'

type TestableInstrumentation = {
	_processHeadMutationObserverRecords: (mutations: MutationRecord[]) => void
	_startPerformanceObserver: () => void
	_tracer: { startSpan: ReturnType<typeof vi.fn> }
	enable: () => void
}

class MockPerformanceObserver {
	static instances: MockPerformanceObserver[] = []

	disconnect = vi.fn()

	observe = vi.fn()

	constructor(private readonly callback: PerformanceObserverCallback) {
		MockPerformanceObserver.instances.push(this)
	}

	emit(entries: PerformanceEntry[]): void {
		this.callback(
			{ getEntries: () => entries } as PerformanceObserverEntryList,
			this as unknown as PerformanceObserver,
		)
	}
}

afterEach(() => {
	document.head.querySelectorAll('[data-test-resource-base]').forEach((element) => element.remove())
	MockPerformanceObserver.instances = []
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('post document load resource instrumentation', () => {
	it('starts observing on the trusted load event', () => {
		vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
		const addEventListener = vi.spyOn(window, 'addEventListener')
		const { instrumentation } = createInstrumentation()

		instrumentation.enable()
		const loadListener = addEventListener.mock.calls.find(([event]) => event === 'load')?.[1] as EventListener
		loadListener({ isTrusted: true } as Event)

		expect(MockPerformanceObserver.instances).toHaveLength(1)
	})

	it('does not duplicate a resource handled by document-load instrumentation', () => {
		const { instrumentation, startSpan } = createInstrumentation()
		const resource = createResourceEntry('script', 'https://example.test/script.js')

		markResourceHandledByDocumentLoad(resource)
		instrumentation._startPerformanceObserver()
		MockPerformanceObserver.instances[0].emit([resource])
		vi.runAllTimers()

		expect(startSpan).not.toHaveBeenCalled()
	})

	it('resolves element resource URLs against the document base', () => {
		const base = document.createElement('base')
		base.dataset.testResourceBase = ''
		base.href = '/resource-observer/page/'
		document.head.prepend(base)

		const activeContext = ROOT_CONTEXT.setValue(Symbol('active-context'), true)
		vi.spyOn(context, 'active').mockReturnValue(activeContext)

		const link = document.createElement('link')
		link.href = 'assets/style.css'
		const script = document.createElement('script')
		script.src = 'assets/script.js'

		const { instrumentation, startSpan } = createInstrumentation()
		instrumentation._processHeadMutationObserverRecords([
			{ addedNodes: [link, script] } as unknown as MutationRecord,
		])
		instrumentation._startPerformanceObserver()
		MockPerformanceObserver.instances[0].emit([
			createResourceEntry('link', link.href),
			createResourceEntry('script', script.src),
		])
		vi.runAllTimers()

		expect(startSpan).toHaveBeenCalledTimes(2)
		expect(startSpan).toHaveBeenNthCalledWith(
			1,
			'resourceFetch',
			expect.objectContaining({ startTime: 10 }),
			activeContext,
		)
		expect(startSpan).toHaveBeenNthCalledWith(
			2,
			'resourceFetch',
			expect.objectContaining({ startTime: 10 }),
			activeContext,
		)
	})

	it('creates a resource span for other initiator types by default', () => {
		const { instrumentation, setAttribute, startSpan } = createInstrumentation()

		instrumentation._startPerformanceObserver()
		MockPerformanceObserver.instances[0].emit([createResourceEntry('other', 'https://example.test/icon.svg')])
		vi.runAllTimers()

		expect(startSpan).toHaveBeenCalledOnce()
		expect(startSpan).toHaveBeenCalledWith('resourceFetch', expect.objectContaining({ startTime: 10 }), undefined)
		expect(setAttribute).toHaveBeenCalledWith('http.url', 'https://example.test/icon.svg')
	})

	it('keeps arbitrary other resources disabled when only font is configured', () => {
		const { instrumentation, setAttribute, startSpan } = createInstrumentation({
			allowedInitiatorTypes: ['font'],
		})

		instrumentation._startPerformanceObserver()
		MockPerformanceObserver.instances[0].emit([
			createResourceEntry('other', 'https://example.test/icon.svg'),
			createResourceEntry('other', 'https://example.test/font.woff2'),
		])
		vi.runAllTimers()

		expect(startSpan).toHaveBeenCalledOnce()
		expect(startSpan).toHaveBeenCalledWith('resourceFetch', expect.objectContaining({ startTime: 10 }), undefined)
		expect(setAttribute).toHaveBeenCalledWith('http.url', 'https://example.test/font.woff2')
		expect(setAttribute).not.toHaveBeenCalledWith('http.url', 'https://example.test/icon.svg')
	})
})

function createInstrumentation(config: SplunkPostDocLoadResourceInstrumentationConfig = {}): {
	instrumentation: TestableInstrumentation
	setAttribute: ReturnType<typeof vi.fn>
	startSpan: ReturnType<typeof vi.fn>
} {
	vi.useFakeTimers()
	vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)

	const setAttribute = vi.fn().mockReturnThis()
	const span = {
		addEvent: vi.fn(),
		end: vi.fn(),
		setAttribute,
	} as unknown as Span
	const startSpan = vi.fn(() => span)
	const instrumentation = new SplunkPostDocLoadResourceInstrumentation(
		config,
		{},
	) as unknown as TestableInstrumentation
	instrumentation._tracer = { startSpan }

	return { instrumentation, setAttribute, startSpan }
}

function createResourceEntry(initiatorType: string, name: string): PerformanceResourceTiming {
	return {
		fetchStart: 10,
		initiatorType,
		name,
		responseEnd: 20,
	} as PerformanceResourceTiming
}
