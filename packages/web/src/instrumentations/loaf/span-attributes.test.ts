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

import { describe, expect, it } from 'vitest'

import { createSpanMock } from '../../../tests/utils/span-mock'
import { setLoafEntryAttributes } from './span-attributes'
import { type PerformanceLongAnimationFrameTimingStable, type PerformanceScriptTimingStable } from './types'

describe('LoAF span attributes', () => {
	it('sets frame attributes and script count when no scripts are present', () => {
		const { attributes, span } = createSpanMock()

		setLoafEntryAttributes(span, createLoafEntry({ scripts: [] }))

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

	it('sets capped script summary attributes', () => {
		const { attributes, span } = createSpanMock()

		setLoafEntryAttributes(
			span,
			createLoafEntry({
				scripts: [
					createScript({ duration: 5, sourceURL: '/small.js?token=secret#hash' }),
					createScript({
						duration: 161.3,
						executionStart: 162.455,
						invoker: 'http://localhost:3030/splunk-otel-web.js',
						invokerType: 'classic-script',
						pauseDuration: 1.234,
						sourceCharPosition: 234,
						sourceFunctionName: '',
						sourceURL: 'http://localhost:3030/splunk-otel-web.js',
						startTime: 160.111,
					}),
					createScript({ duration: 20, sourceURL: 'blob:https://example.com/id?kept=true#kept' }),
					createScript({ duration: 30, sourceURL: '<anonymous>' }),
				],
			}),
		)

		expect(attributes).toMatchObject({
			'loaf.script_count': 4,
			'loaf.script[0].duration': 161.3,
			'loaf.script[0].execution_start': 162.46,
			'loaf.script[0].forced_style_and_layout_duration': 0,
			'loaf.script[0].invoker': 'http://localhost:3030/splunk-otel-web.js',
			'loaf.script[0].invoker_type': 'classic-script',
			'loaf.script[0].pause_duration': 1.23,
			'loaf.script[0].source_char_position': 234,
			'loaf.script[0].source_function_name': '',
			'loaf.script[0].source_url': 'http://localhost:3030/splunk-otel-web.js',
			'loaf.script[0].start_time': 160.11,
			'loaf.script[1].duration': 30,
			'loaf.script[1].source_url': '<anonymous>',
			'loaf.script[2].duration': 20,
			'loaf.script[2].source_url': 'blob:https://example.com/id?kept=true#kept',
		})
		expect(attributes['loaf.script[3].duration']).toBeUndefined()
	})

	it('omits non-finite numeric attributes while preserving empty strings', () => {
		const { attributes, span } = createSpanMock()

		setLoafEntryAttributes(
			span,
			createLoafEntry({
				blockingDuration: Number.POSITIVE_INFINITY,
				duration: Number.NaN,
				paintTime: Number.POSITIVE_INFINITY,
				presentationTime: Number.NaN,
				renderStart: Number.NEGATIVE_INFINITY,
				scripts: [
					createScript({
						duration: Number.NaN,
						executionStart: Number.NaN,
						pauseDuration: Number.POSITIVE_INFINITY,
						sourceCharPosition: Number.NaN,
						sourceFunctionName: '',
						sourceURL: '',
						startTime: Number.NEGATIVE_INFINITY,
					}),
				],
			}),
		)

		expect(attributes).toEqual({
			'component': 'splunk-loaf',
			'loaf.entry_type': 'long-animation-frame',
			'loaf.first_ui_event_timestamp': 0,
			'loaf.name': 'long-animation-frame',
			'loaf.script_count': 1,
			'loaf.script[0].forced_style_and_layout_duration': 0,
			'loaf.script[0].invoker': 'event-listener',
			'loaf.script[0].invoker_type': 'event-listener',
			'loaf.script[0].source_function_name': '',
			'loaf.script[0].source_url': '',
			'loaf.style_and_layout_start': 0,
		})
	})

	it('falls back for malformed runtime entry shapes', () => {
		const { attributes, span } = createSpanMock()

		setLoafEntryAttributes(span, {
			...createLoafEntry(),
			entryType: 1,
			name: 2,
			scripts: 'not scripts',
		} as unknown as PerformanceLongAnimationFrameTimingStable)

		expect(attributes).toEqual({
			'component': 'splunk-loaf',
			'loaf.blocking_duration': 111.4,
			'loaf.duration': 161.38,
			'loaf.first_ui_event_timestamp': 0,
			'loaf.paint_time': 0,
			'loaf.presentation_time': 0,
			'loaf.render_start': 0,
			'loaf.script_count': 0,
			'loaf.style_and_layout_start': 0,
		})
	})
})

function createLoafEntry({
	blockingDuration = 111.4,
	duration = 161.381,
	firstUIEventTimestamp = 0,
	paintTime = 0,
	presentationTime = 0,
	renderStart = 0,
	scripts = [createScript()],
	styleAndLayoutStart = 0,
}: Partial<{
	blockingDuration: number
	duration: number
	firstUIEventTimestamp: number
	paintTime: number
	presentationTime: number
	renderStart: number
	scripts: PerformanceScriptTimingStable[]
	styleAndLayoutStart: number
}> = {}): PerformanceLongAnimationFrameTimingStable {
	return {
		blockingDuration,
		duration,
		entryType: 'long-animation-frame',
		firstUIEventTimestamp,
		name: 'long-animation-frame',
		paintTime,
		presentationTime,
		renderStart,
		scripts,
		startTime: 10,
		styleAndLayoutStart,
		toJSON: () => ({}),
	}
}

function createScript({
	duration = 10,
	executionStart = 0,
	forcedStyleAndLayoutDuration = 0,
	invoker = 'event-listener',
	invokerType = 'event-listener',
	pauseDuration = 0,
	sourceCharPosition = 0,
	sourceFunctionName = 'handler',
	sourceURL = 'https://example.com/app.js',
	startTime = 0,
}: Partial<{
	duration: number
	executionStart: number
	forcedStyleAndLayoutDuration: number
	invoker: string
	invokerType: string
	pauseDuration: number
	sourceCharPosition: number
	sourceFunctionName: string
	sourceURL: string
	startTime: number
}> = {}): PerformanceScriptTimingStable {
	return {
		duration,
		entryType: 'script',
		executionStart,
		forcedStyleAndLayoutDuration,
		invoker,
		invokerType,
		name: 'script',
		pauseDuration,
		sourceCharPosition,
		sourceFunctionName,
		sourceURL,
		startTime,
		toJSON: () => ({}),
	}
}
