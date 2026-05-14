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
import { describe, expect, it, vi } from 'vitest'
import { CLSMetricWithAttribution, INPMetricWithAttribution, LCPMetricWithAttribution } from 'web-vitals/attribution'

import { setCLSAttributionAttributes } from './cls'
import { setINPAttributionAttributes } from './inp'
import { setLCPAttributionAttributes } from './lcp'
import { WebVitalsAttributionOptions } from './types'

describe('webvitals attribution attribute setters', () => {
	describe('setCLSAttributionAttributes', () => {
		it('emits CLS attribution attributes including target and source rects', () => {
			const { attributes, span } = createSpanMock()

			setCLSAttributionAttributes(span, createCLSMetric(), createAttributionOptions())

			expect(attributes).toEqual({
				'cls.largest_shift_source.current_rect.height': 45,
				'cls.largest_shift_source.current_rect.width': 35,
				'cls.largest_shift_source.current_rect.x': 15,
				'cls.largest_shift_source.current_rect.y': 25,
				'cls.largest_shift_source.previous_rect.height': 40,
				'cls.largest_shift_source.previous_rect.width': 30,
				'cls.largest_shift_source.previous_rect.x': 10,
				'cls.largest_shift_source.previous_rect.y': 20,
				'cls.largest_shift_target': 'main>button',
				'cls.largest_shift_time': 123,
				'cls.largest_shift_value': 0.25,
				'cls.load_state': 'complete',
			})
		})

		it('omits CLS target and source rect attributes when unavailable or disabled', () => {
			const { attributes, span } = createSpanMock()

			setCLSAttributionAttributes(
				span,
				createCLSMetric({
					largestShiftSource: undefined,
				}),
				createAttributionOptions({ shouldExportTarget: false }),
			)

			expect(attributes).toEqual({
				'cls.largest_shift_time': 123,
				'cls.largest_shift_value': 0.25,
				'cls.load_state': 'complete',
			})
		})
	})

	describe('setINPAttributionAttributes', () => {
		it('emits INP attribution attributes including target and longest script fields', () => {
			const { attributes, span } = createSpanMock()

			setINPAttributionAttributes(span, createINPMetric(), createAttributionOptions())

			expect(attributes).toEqual({
				'inp.input_delay': 30,
				'inp.interaction_target': 'main>button',
				'inp.interaction_time': 100,
				'inp.interaction_type': 'pointer',
				'inp.load_state': 'complete',
				'inp.longest_script_intersecting_duration': 12,
				'inp.longest_script_subpart': 'script',
				'inp.next_paint_time': 160,
				'inp.presentation_delay': 20,
				'inp.processing_duration': 40,
				'inp.total_paint_duration': 5,
				'inp.total_script_duration': 70,
				'inp.total_style_and_layout_duration': 10,
				'inp.total_unattributed_duration': 3,
			})
		})

		it('omits INP target and optional longest script attributes when unavailable or disabled', () => {
			const { attributes, span } = createSpanMock()

			setINPAttributionAttributes(
				span,
				createINPMetric({
					longestScript: undefined,
				}),
				createAttributionOptions({ shouldExportTarget: false }),
			)

			expect(attributes).toEqual({
				'inp.input_delay': 30,
				'inp.interaction_time': 100,
				'inp.interaction_type': 'pointer',
				'inp.load_state': 'complete',
				'inp.next_paint_time': 160,
				'inp.presentation_delay': 20,
				'inp.processing_duration': 40,
				'inp.total_paint_duration': 5,
				'inp.total_script_duration': 70,
				'inp.total_style_and_layout_duration': 10,
				'inp.total_unattributed_duration': 3,
			})
		})
	})

	describe('setLCPAttributionAttributes', () => {
		it('emits LCP attribution attributes including sanitized URL and resource timing', () => {
			const { attributes, span } = createSpanMock()
			const getLCPUrl = vi.fn((url: string | undefined) => (url ? `sanitized:${url}` : undefined))

			setLCPAttributionAttributes(span, createLCPMetric(), createAttributionOptions({ getLCPUrl }))

			expect(getLCPUrl).toHaveBeenCalledWith('https://example.com/image.png?secret=1')
			expect(attributes).toEqual({
				'http.response.body.size': 2000,
				'http.response.body.uncompressed_size': 3000,
				'http.response.status_code': 200,
				'lcp.element_render_delay': 40,
				'lcp.resource_load_delay': 20,
				'lcp.resource_load_duration': 30,
				'lcp.resource.initiator_type': 'img',
				'lcp.resource.transfer_size': 1000,
				'lcp.target': 'main>img',
				'lcp.time_to_first_byte': 10,
				'lcp.url': 'sanitized:https://example.com/image.png?secret=1',
				'network.protocol.name': 'h2',
			})
		})

		it('omits LCP target, URL, and invalid resource timing attributes when unavailable or disabled', () => {
			const { attributes, span } = createSpanMock()
			const getLCPUrl = vi.fn((): string | undefined => undefined)

			setLCPAttributionAttributes(
				span,
				createLCPMetric({
					lcpResourceEntry: {
						decodedBodySize: Number.POSITIVE_INFINITY,
						encodedBodySize: Number.NaN,
						initiatorType: '',
						nextHopProtocol: '',
						responseStatus: Number.NEGATIVE_INFINITY,
						transferSize: Number.NaN,
					} as PerformanceResourceTiming & { responseStatus: number },
				}),
				createAttributionOptions({ getLCPUrl, shouldExportTarget: false }),
			)

			expect(getLCPUrl).toHaveBeenCalledWith('https://example.com/image.png?secret=1')
			expect(attributes).toEqual({
				'lcp.element_render_delay': 40,
				'lcp.resource_load_delay': 20,
				'lcp.resource_load_duration': 30,
				'lcp.time_to_first_byte': 10,
			})
		})
	})
})

function createAttributionOptions(overrides: Partial<WebVitalsAttributionOptions> = {}): WebVitalsAttributionOptions {
	return {
		getLCPUrl: (url) => url,
		shouldExportTarget: true,
		...overrides,
	}
}

function createCLSMetric(
	attributionOverrides: Partial<CLSMetricWithAttribution['attribution']> = {},
): CLSMetricWithAttribution {
	return {
		attribution: {
			largestShiftSource: {
				currentRect: {
					height: 45,
					width: 35,
					x: 15,
					y: 25,
				},
				previousRect: {
					height: 40,
					width: 30,
					x: 10,
					y: 20,
				},
			},
			largestShiftTarget: 'main>button',
			largestShiftTime: 123,
			largestShiftValue: 0.25,
			loadState: 'complete',
			...attributionOverrides,
		},
	} as unknown as CLSMetricWithAttribution
}

function createINPMetric(
	attributionOverrides: Partial<INPMetricWithAttribution['attribution']> = {},
): INPMetricWithAttribution {
	return {
		attribution: {
			inputDelay: 30,
			interactionTarget: 'main>button',
			interactionTime: 100,
			interactionType: 'pointer',
			loadState: 'complete',
			longestScript: {
				intersectingDuration: 12,
				subpart: 'script',
			},
			nextPaintTime: 160,
			presentationDelay: 20,
			processingDuration: 40,
			totalPaintDuration: 5,
			totalScriptDuration: 70,
			totalStyleAndLayoutDuration: 10,
			totalUnattributedDuration: 3,
			...attributionOverrides,
		},
	} as unknown as INPMetricWithAttribution
}

function createLCPMetric(
	attributionOverrides: Partial<LCPMetricWithAttribution['attribution']> = {},
): LCPMetricWithAttribution {
	return {
		attribution: {
			elementRenderDelay: 40,
			lcpResourceEntry: {
				decodedBodySize: 3000,
				encodedBodySize: 2000,
				initiatorType: 'img',
				nextHopProtocol: 'h2',
				responseStatus: 200,
				transferSize: 1000,
			},
			resourceLoadDelay: 20,
			resourceLoadDuration: 30,
			target: 'main>img',
			timeToFirstByte: 10,
			url: 'https://example.com/image.png?secret=1',
			...attributionOverrides,
		},
	} as unknown as LCPMetricWithAttribution
}

function createSpanMock(): { attributes: Record<string, number | string>; span: Span } {
	const attributes: Record<string, number | string> = {}
	const span = {
		setAttribute: (name: string, value: number | string) => {
			attributes[name] = value
			return span
		},
	} as Span

	return { attributes, span }
}
