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

import { createSpanMock } from '../../tests/utils/span-mock'
import { SplunkOtelWebConfig } from '../types'
import {
	getLoafScriptSummaries,
	isLongAnimationFrameSupported,
	LONG_ANIMATION_FRAME_PERFORMANCE_TYPE,
	MAX_LOAF_SPANS_PER_SESSION,
	normalizeLoafSourceUrl,
	PerformanceScriptTimingStable,
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

		expect(span.end).toHaveBeenCalledWith(130)
		expect(attributes).toEqual({
			'component': 'splunk-loaf',
			'loaf.blocking_duration': 70,
			'loaf.duration': 120,
			'loaf.entry_type': 'long-animation-frame',
			'loaf.first_ui_event_timestamp': 0,
			'loaf.name': 'long-animation-frame',
			'loaf.render_start': 30,
			'loaf.script_count': 0,
			'loaf.style_and_layout_start': 60,
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
						duration: 40,
						invoker: 'setTimeout',
						sourceURL: 'https://example.com/large.js?a=1',
					}),
					createScript({ duration: 20, sourceURL: 'blob:https://example.com/id?kept=true#kept' }),
					createScript({ duration: 30, sourceURL: '<anonymous>' }),
				],
			}),
		])

		expect(attributes).toMatchObject({
			'loaf.script_count': 4,
			'loaf.script[0].duration': 40,
			'loaf.script[0].invoker': 'setTimeout',
			'loaf.script[0].source_url': 'https://example.com/large.js',
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

	it('normalizes source URLs using the v1 URL policy', () => {
		expect(normalizeLoafSourceUrl('/assets/app.js?token=secret#hash')).toBe(`${location.origin}/assets/app.js`)
		expect(normalizeLoafSourceUrl('chunk.js?token=secret#hash')).toBe(`${location.origin}/chunk.js`)
		expect(normalizeLoafSourceUrl('https://example.com/app.js?token=secret#hash')).toBe(
			'https://example.com/app.js',
		)
		expect(normalizeLoafSourceUrl('blob:https://example.com/app.js?token=secret#hash')).toBe(
			'blob:https://example.com/app.js?token=secret#hash',
		)
		expect(normalizeLoafSourceUrl('data:text/javascript,alert(1)')).toBe('data:text/javascript,alert(1)')
		expect(normalizeLoafSourceUrl('<anonymous>')).toBe('<anonymous>')
		expect(normalizeLoafSourceUrl('')).toBe('')
		expect(normalizeLoafSourceUrl('not a url')).toBe('not a url')
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

	it('caps LoAF spans per instrumentation instance', () => {
		installPerformanceObserver([LONG_ANIMATION_FRAME_PERFORMANCE_TYPE])
		const { instrumentation } = createLoafInstrumentationMock()

		instrumentation.enable()
		mockObservers[0].emit(Array.from({ length: MAX_LOAF_SPANS_PER_SESSION + 1 }, () => createLoafEntry()))

		expect(instrumentation._tracer.startSpan).toHaveBeenCalledTimes(MAX_LOAF_SPANS_PER_SESSION)
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

function createLoafEntry({
	duration = 120,
	scripts = [createScript()],
}: {
	duration?: number
	scripts?: PerformanceScriptTimingStable[]
} = {}): PerformanceEntry {
	return {
		blockingDuration: 70,
		duration,
		entryType: 'long-animation-frame',
		firstUIEventTimestamp: 0,
		name: 'long-animation-frame',
		renderStart: 30,
		scripts,
		startTime: 10,
		styleAndLayoutStart: 60,
		toJSON: () => ({}),
	} as unknown as PerformanceEntry
}

function createScript({
	duration = 10,
	forcedStyleAndLayoutDuration = 0,
	invoker = 'event-listener',
	invokerType = 'event-listener',
	sourceFunctionName = 'handler',
	sourceURL = 'https://example.com/app.js',
}: Partial<{
	duration: number
	forcedStyleAndLayoutDuration: number
	invoker: string
	invokerType: string
	sourceFunctionName: string
	sourceURL: string
}> = {}): PerformanceScriptTimingStable {
	return {
		duration,
		entryType: 'script',
		forcedStyleAndLayoutDuration,
		invoker,
		invokerType,
		name: 'script',
		sourceFunctionName,
		sourceURL,
		startTime: 0,
		toJSON: () => ({}),
	}
}
