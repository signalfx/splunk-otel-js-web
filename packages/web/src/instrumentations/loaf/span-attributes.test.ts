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
			'loaf.blocking_duration': 70,
			'loaf.duration': 120,
			'loaf.entry_type': 'long-animation-frame',
			'loaf.first_ui_event_timestamp': 0,
			'loaf.name': 'long-animation-frame',
			'loaf.paint_time': 90,
			'loaf.presentation_time': 100,
			'loaf.render_start': 30,
			'loaf.script_count': 0,
			'loaf.style_and_layout_start': 60,
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
						duration: 40,
						invoker: 'setTimeout',
						sourceURL: 'https://example.com/large.js?a=1',
					}),
					createScript({ duration: 20, sourceURL: 'blob:https://example.com/id?kept=true#kept' }),
					createScript({ duration: 30, sourceURL: '<anonymous>' }),
				],
			}),
		)

		expect(attributes).toMatchObject({
			'loaf.script_count': 4,
			'loaf.script[0].duration': 40,
			'loaf.script[0].forced_style_and_layout_duration': 0,
			'loaf.script[0].invoker': 'setTimeout',
			'loaf.script[0].invoker_type': 'event-listener',
			'loaf.script[0].source_function_name': 'handler',
			'loaf.script[0].source_url': 'https://example.com/large.js',
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
				scripts: [createScript({ duration: Number.NaN, sourceFunctionName: '', sourceURL: '' })],
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
			'loaf.style_and_layout_start': 60,
		})
	})
})

function createLoafEntry({
	blockingDuration = 70,
	duration = 120,
	firstUIEventTimestamp = 0,
	paintTime = 90,
	presentationTime = 100,
	renderStart = 30,
	scripts = [createScript()],
	styleAndLayoutStart = 60,
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
