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

import { Span } from '@opentelemetry/api'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLoafEntry, createScript, createSpanMock } from '@/tests/utils'

import { SplunkOtelWebConfig } from '../types'
import { MAX_LOAF_SPANS_PER_SOURCE_WINDOW } from './loaf/constants'
import {
	getLoafScriptSummaries,
	isLongAnimationFrameSupported,
	LONG_ANIMATION_FRAME_PERFORMANCE_TYPE,
	SplunkLongAnimationFrameInstrumentation,
} from './splunk-long-animation-frame-instrumentation'
import { SplunkLongTaskInstrumentation } from './splunk-long-task-instrumentation'

type MockObserve = (options?: PerformanceObserverInit) => void

type TestableInstrumentation = {
	_tracer: { startSpan: ReturnType<typeof vi.fn> }
	disable: () => void
	enable: () => void
}

function callMockObserveImplementation(options?: PerformanceObserverInit): void {
	MockPerformanceObserver.observeImplementation?.(options)
}

class MockPerformanceObserver {
	static observeImplementation: MockObserve | undefined

	static supportedEntryTypes: string[] | undefined = []

	disconnect = vi.fn()

	observe = vi.fn<MockObserve>(callMockObserveImplementation)

	constructor(private callback: PerformanceObserverCallback) {
		mockObservers.push(this)
	}

	emit(entries: PerformanceEntry[]): void {
		this.callback(
			{ getEntries: () => entries } as PerformanceObserverEntryList,
			this as unknown as PerformanceObserver,
		)
	}
}

let mockObservers: MockPerformanceObserver[] = []

afterEach(() => {
	vi.unstubAllGlobals()
	mockObservers = []
	MockPerformanceObserver.observeImplementation = undefined
	MockPerformanceObserver.supportedEntryTypes = []
})

describe('long animation frame instrumentation', () => {
	it('detects support from PerformanceObserver.supportedEntryTypes', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])

		expect(isLongAnimationFrameSupported()).toBe(true)
	})

	it('treats missing supportedEntryTypes as unsupported', () => {
		installPerformanceObserver()
		MockPerformanceObserver.supportedEntryTypes = undefined

		expect(isLongAnimationFrameSupported()).toBe(false)
	})

	it('emits frame attributes and script count when no scripts are present', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const { attributes, instrumentation, span } = createLoafInstrumentationMock()

		instrumentation.enable()
		mockObservers[0].emit([createLoafEntry({ scripts: [] })])

		expect(span.end).toHaveBeenCalledWith(688.681_000_011_920_9)
		expect(attributes).toEqual({
			'component': 'splunk-loaf',
			'loaf.blocking_duration': 111.4,
			'loaf.duration': 161.38,
			'loaf.entry_type': 'long-animation-frame',
			'loaf.first_ui_event_timestamp': 0,
			'loaf.name': 'long-animation-frame',
			'loaf.paint_time': 0,
			'loaf.presentation_time': 0,
			'loaf.render_start': 0,
			'loaf.script_count': 0,
			'loaf.style_and_layout_start': 0,
		})
	})

	it('exports exactly three scripts sorted by duration', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const { attributes, instrumentation } = createLoafInstrumentationMock()

		instrumentation.enable()
		mockObservers[0].emit([
			createLoafEntry({
				scripts: [
					createScript({ duration: 5, sourceURL: '/small.js?token=secret#hash' }),
					createScript({
						duration: 161.3,
						executionStart: 162.455,
						invoker: 'http://localhost:3030/splunk-otel-web.js?token=secret#hash',
						pauseDuration: 1.234,
						sourceCharPosition: 234,
						sourceURL: 'http://localhost:3030/splunk-otel-web.js',
						startTime: 160.111,
						windowAttribution: 'self',
					}),
					createScript({ duration: 20, sourceURL: 'blob:https://example.com/id?kept=true#kept' }),
					createScript({ duration: 30, sourceURL: '<anonymous>' }),
				],
			}),
		])

		expect(attributes).toMatchObject({
			'loaf.script_count': 4,
			'loaf.script[0].duration': 161.3,
			'loaf.script[0].execution_start': 162.46,
			'loaf.script[0].invoker': 'http://localhost:3030/splunk-otel-web.js?token=secret#hash',
			'loaf.script[0].pause_duration': 1.23,
			'loaf.script[0].source_char_position': 234,
			'loaf.script[0].source_url': 'http://localhost:3030/splunk-otel-web.js',
			'loaf.script[0].start_time': 160.11,
			'loaf.script[0].window_attribution': 'self',
			'loaf.script[1].duration': 30,
			'loaf.script[1].source_url': '<anonymous>',
			'loaf.script[2].duration': 20,
			'loaf.script[2].source_url': 'blob:https://example.com/id?kept=true#kept',
		})
		expect(attributes['loaf.script[3].duration']).toBeUndefined()
	})

	it('exports all three scripts at the cap boundary', () => {
		const summaries = getLoafScriptSummaries([
			createScript({ duration: 1 }),
			createScript({ duration: 2 }),
			createScript({ duration: 3 }),
		])

		expect(summaries).toHaveLength(3)
		expect(summaries.map((script) => script.duration)).toEqual([3, 2, 1])
	})

	it('emits empty source_url for opaque cross-origin scripts', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const { attributes, instrumentation } = createLoafInstrumentationMock()

		instrumentation.enable()
		mockObservers[0].emit([createLoafEntry({ scripts: [createScript({ sourceURL: '' })] })])

		expect('loaf.script[0].source_url' in attributes).toBe(true)
		expect(attributes['loaf.script[0].source_url']).toBe('')
	})

	it('does not crash init if observe throws', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE], () => {
			throw new Error('observer failed')
		})
		const { instrumentation } = createLoafInstrumentationMock()

		instrumentation.enable()
		instrumentation.disable()

		expect(mockObservers[0].disconnect).toHaveBeenCalledTimes(1)
	})

	it('does not cap LoAF spans per session', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const { instrumentation } = createLoafInstrumentationMock()
		const spanCount = 1001

		instrumentation.enable()
		mockObservers[0].emit(
			Array.from({ length: spanCount }, (_, index) =>
				createLoafEntry({
					scripts: [createScript({ sourceFunctionName: `handler${index}` })],
					startTime: index,
				}),
			),
		)

		expect(instrumentation._tracer.startSpan).toHaveBeenCalledTimes(spanCount)
	})

	it('caps repeated LoAF spans per source window', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const { instrumentation } = createLoafInstrumentationMock()

		instrumentation.enable()
		mockObservers[0].emit(
			Array.from({ length: MAX_LOAF_SPANS_PER_SOURCE_WINDOW + 1 }, (_, index) =>
				createLoafEntry({ startTime: index }),
			),
		)

		expect(instrumentation._tracer.startSpan).toHaveBeenCalledTimes(MAX_LOAF_SPANS_PER_SOURCE_WINDOW)
	})

	it('limits distinct LoAF sources independently', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const { instrumentation } = createLoafInstrumentationMock()

		instrumentation.enable()
		mockObservers[0].emit([
			...Array.from({ length: MAX_LOAF_SPANS_PER_SOURCE_WINDOW + 1 }, (_, index) =>
				createLoafEntry({ startTime: index }),
			),
			createLoafEntry({
				scripts: [createScript({ sourceFunctionName: 'otherHandler' })],
				startTime: MAX_LOAF_SPANS_PER_SOURCE_WINDOW,
			}),
		])

		expect(instrumentation._tracer.startSpan).toHaveBeenCalledTimes(MAX_LOAF_SPANS_PER_SOURCE_WINDOW + 1)
	})
})

describe('longtask suppression for LoAF', () => {
	it('suppresses longtask when LoAF is configured and supported', () => {
		installPerformanceObserver(['longtask', LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const instrumentation = createLongTaskInstrumentationMock({
			instrumentations: { loaf: true },
		})

		instrumentation.enable()

		expect(mockObservers).toHaveLength(0)
	})

	it('keeps longtask active when LoAF is unsupported', () => {
		installPerformanceObserver(['longtask'])
		const instrumentation = createLongTaskInstrumentationMock({
			instrumentations: { loaf: true },
		})

		instrumentation.enable()

		expect(mockObservers).toHaveLength(1)
		expect(mockObservers[0].observe).toHaveBeenCalledWith({ buffered: true, type: 'longtask' })
	})

	it('keeps longtask active when LoAF is not configured', () => {
		installPerformanceObserver(['longtask', LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const instrumentation = createLongTaskInstrumentationMock({ instrumentations: {} })

		instrumentation.enable()

		expect(mockObservers).toHaveLength(1)
		expect(mockObservers[0].observe).toHaveBeenCalledWith({ buffered: true, type: 'longtask' })
	})

	it('keeps longtask active when LoAF config is disabled', () => {
		installPerformanceObserver(['longtask', LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const instrumentation = createLongTaskInstrumentationMock({
			instrumentations: { loaf: { enabled: false } },
		})

		instrumentation.enable()

		expect(mockObservers).toHaveLength(1)
		expect(mockObservers[0].observe).toHaveBeenCalledWith({ buffered: true, type: 'longtask' })
	})
})

function installPerformanceObserver(supportedEntryTypes?: string[], observe?: MockObserve): void {
	MockPerformanceObserver.observeImplementation = observe
	MockPerformanceObserver.supportedEntryTypes = supportedEntryTypes
	vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
}

function createLoafInstrumentationMock(): {
	attributes: Record<string, number | string>
	instrumentation: TestableInstrumentation
	span: Span & { end: ReturnType<typeof vi.fn> }
} {
	const { attributes, span } = createSpanMock()
	const spanWithEnd = Object.assign(span, { end: vi.fn() }) as Span & { end: ReturnType<typeof vi.fn> }
	const instrumentation = new SplunkLongAnimationFrameInstrumentation(
		{ enabled: false },
		{},
	) as unknown as TestableInstrumentation

	instrumentation._tracer = {
		startSpan: vi.fn(() => spanWithEnd),
	}

	return { attributes, instrumentation, span: spanWithEnd }
}

function createLongTaskInstrumentationMock(config: SplunkOtelWebConfig): SplunkLongTaskInstrumentation {
	return new SplunkLongTaskInstrumentation({ enabled: false }, config)
}
