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
import { expectDefined } from '@test-utils/assertions'
import { describe, expect, it, vi } from 'vitest'
import { LCPMetricWithAttribution } from 'web-vitals/attribution'

import { SplunkWebVitalsInstrumentation } from '../src/instrumentations/splunk-webvitals-instrumentation'
import {
	getLCPResourceTimingAttributes,
	getLCPUrlForAttribution,
	getResolvedWebVitalsAttributionConfig,
	getWebVitalMetricReportKey,
	isWebVitalsAttributionEnabled,
	sanitizeLCPUrl,
} from '../src/instrumentations/webvitals'

describe('webvitals attribution helpers', () => {
	it('resolves relative LCP URLs against the current location and strips fragments', () => {
		const sanitized = sanitizeLCPUrl('/static/image.png?token=abc#hash')
		expectDefined(sanitized)
		expect(sanitized.endsWith('/static/image.png')).toBe(true)
		expect(sanitized).not.toContain('token=abc')
		expect(sanitized).not.toContain('#')
	})

	it('rejects malformed and non-http(s) LCP URLs', () => {
		expect(sanitizeLCPUrl('http://[::1')).toBeUndefined()
		expect(sanitizeLCPUrl('blob:https://example.com/abc')).toBeUndefined()
		expect(sanitizeLCPUrl('javascript:alert(1)')).toBeUndefined()
		expect(sanitizeLCPUrl()).toBeUndefined()
		expect(sanitizeLCPUrl('')).toBeUndefined()
	})

	it('merges partial attribution configs onto privacy-preserving defaults', () => {
		expect(getResolvedWebVitalsAttributionConfig()).toEqual({
			lcpUrl: 'sanitized',
			target: 'safe',
		})
		expect(getResolvedWebVitalsAttributionConfig(true)).toEqual({
			lcpUrl: 'sanitized',
			target: 'safe',
		})
		expect(getResolvedWebVitalsAttributionConfig({})).toEqual({
			lcpUrl: 'sanitized',
			target: 'safe',
		})
		expect(getResolvedWebVitalsAttributionConfig({ target: 'raw' })).toEqual({
			lcpUrl: 'sanitized',
			target: 'raw',
		})
		expect(getResolvedWebVitalsAttributionConfig({ lcpUrl: 'off' })).toEqual({
			lcpUrl: 'off',
			target: 'safe',
		})
	})

	it('enables attribution for true or config object options only', () => {
		expect(isWebVitalsAttributionEnabled(true)).toBe(true)
		expect(isWebVitalsAttributionEnabled({})).toBe(true)
		expect(isWebVitalsAttributionEnabled({ target: 'raw' })).toBe(true)
		expect(isWebVitalsAttributionEnabled(false)).toBe(false)
		expect(isWebVitalsAttributionEnabled()).toBe(false)
	})

	it('applies LCP URL attribution policy defaults and overrides', () => {
		const fullUrl = 'https://example.com/path/image.png?token=secret#fragment'

		expect(getLCPUrlForAttribution(fullUrl)).toBe('https://example.com/path/image.png')
		expect(getLCPUrlForAttribution(fullUrl, { lcpUrl: 'raw' })).toBe(fullUrl)
		expect(getLCPUrlForAttribution(fullUrl, { lcpUrl: 'off' })).toBeUndefined()
		expect(getLCPUrlForAttribution('data:image/png;base64,secret')).toBeUndefined()
	})

	it('builds metric report keys from metric identity fields', () => {
		const baseMetric = {
			delta: 10,
			id: 'v5-1',
			navigationType: 'navigate',
			value: 10,
		} as const

		expect(getWebVitalMetricReportKey('lcp', baseMetric)).toBe('lcp|v5-1|10|10|navigate')
		expect(getWebVitalMetricReportKey('lcp', baseMetric)).not.toBe(getWebVitalMetricReportKey('cls', baseMetric))
		expect(getWebVitalMetricReportKey('fcp', baseMetric)).toBe('fcp|v5-1|10|10|navigate')
		expect(getWebVitalMetricReportKey('ttfb', baseMetric)).toBe('ttfb|v5-1|10|10|navigate')
		expect(getWebVitalMetricReportKey('lcp', baseMetric)).not.toBe(
			getWebVitalMetricReportKey('lcp', { ...baseMetric, delta: 20, value: 30 }),
		)
		expect(getWebVitalMetricReportKey('lcp', baseMetric)).not.toBe(
			getWebVitalMetricReportKey('lcp', { ...baseMetric, id: 'v5-2' }),
		)
	})

	it('maps only available finite LCP resource timing attributes', () => {
		const attributes = getLCPResourceTimingAttributes({
			decodedBodySize: 2000,
			encodedBodySize: 1000,
			initiatorType: 'img',
			nextHopProtocol: 'h2',
			responseStatus: 200,
			transferSize: Number.NaN,
		} as PerformanceResourceTiming & { responseStatus: number })

		expect(attributes).toEqual({
			'http.response.body.size': 1000,
			'http.response.body.uncompressed_size': 2000,
			'http.response.status_code': 200,
			'lcp.resource.initiator_type': 'img',
			'network.protocol.name': 'h2',
		})
	})

	it('emits only the metric value without attribution by default', async () => {
		const { attributes, instrumentation, span } = createWebVitalsInstrumentationMock()

		await reportLCPMetric(instrumentation)

		expect(span.end).toHaveBeenCalled()
		expect(attributes).toEqual({
			lcp: 100,
		})
	})

	it('falls back to wall-clock timing when documentLoad never arrives', async () => {
		vi.useFakeTimers()
		try {
			vi.setSystemTime(1000)
			const { instrumentation, span } = createWebVitalsInstrumentationMock({
				alignWebVitalsSpansWithDocumentLoad: true,
			})

			const reportPromise = reportLCPMetric(instrumentation)
			await vi.advanceTimersByTimeAsync(4999)
			expect(instrumentation._tracer.startSpan).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(1)
			await reportPromise

			expect(instrumentation._tracer.startSpan).toHaveBeenCalledWith('webvitals', { startTime: 1000 })
			expect(span.end).toHaveBeenCalledWith(1000)
		} finally {
			vi.useRealTimers()
		}
	})

	it('emits shared webvitals and attribution fields when experimental attribution is enabled', async () => {
		const { attributes, instrumentation, span } = createWebVitalsInstrumentationMock({
			_experimental_attribution: true,
		})

		await reportLCPMetric(instrumentation)

		expect(span.end).toHaveBeenCalled()
		expect(attributes).toMatchObject({
			'lcp': 100,
			'lcp.element_render_delay': 40,
			'lcp.resource_load_delay': 20,
			'lcp.resource_load_duration': 30,
			'lcp.target': 'main>img',
			'lcp.time_to_first_byte': 10,
			'lcp.url': 'https://example.com/image.png',
			'webvitals.delta': 100,
			'webvitals.metric_id': 'v5-lcp',
			'webvitals.navigation_type': 'navigate',
		})
	})

	it('emits attribution with defaults when experimental attribution is an empty config object', async () => {
		const { attributes, instrumentation, span } = createWebVitalsInstrumentationMock({
			_experimental_attribution: {},
		})

		await reportLCPMetric(instrumentation)

		expect(span.end).toHaveBeenCalled()
		expect(attributes).toMatchObject({
			'lcp': 100,
			'lcp.target': 'main>img',
			'lcp.url': 'https://example.com/image.png',
			'webvitals.metric_id': 'v5-lcp',
		})
	})

	it('applies policy overrides from the experimental attribution config object', async () => {
		const { attributes, instrumentation, span } = createWebVitalsInstrumentationMock({
			_experimental_attribution: {
				lcpUrl: 'raw',
				target: 'off',
			},
		})

		await reportLCPMetric(instrumentation, {
			url: 'https://example.com/image.png?token=secret#fragment',
		})

		expect(span.end).toHaveBeenCalled()
		expect(attributes['lcp']).toBe(100)
		expect(attributes['lcp.target']).toBeUndefined()
		expect(attributes['lcp.url']).toBe('https://example.com/image.png?token=secret#fragment')
		expect(attributes['webvitals.metric_id']).toBe('v5-lcp')
	})

	it('drops raw target fallback selectors when safe attribution is enabled', async () => {
		const { attributes, instrumentation, span } = createWebVitalsInstrumentationMock({
			_experimental_attribution: true,
		})

		await reportLCPMetric(instrumentation, { target: '#private-lcp-id' })

		expect(span.end).toHaveBeenCalled()
		expect(attributes['lcp']).toBe(100)
		expect(attributes['lcp.target']).toBeUndefined()
	})
})

type TestableWebVitalsInstrumentation = {
	_tracer: { startSpan: ReturnType<typeof vi.fn> }
	isRecording: boolean
	reportMetric: (report: { metric: LCPMetricWithAttribution; name: 'lcp' }) => Promise<void>
}

function createWebVitalsInstrumentationMock(
	config: ConstructorParameters<typeof SplunkWebVitalsInstrumentation>[0] = {},
): {
	attributes: Record<string, number | string>
	instrumentation: TestableWebVitalsInstrumentation
	span: Span & { end: ReturnType<typeof vi.fn> }
} {
	const attributes: Record<string, number | string> = {}
	const span = {
		end: vi.fn(),
		setAttribute: (name: string, value: number | string) => {
			attributes[name] = value
			return span
		},
	} as Span & { end: ReturnType<typeof vi.fn> }
	const instrumentation = new SplunkWebVitalsInstrumentation(
		{
			alignWebVitalsSpansWithDocumentLoad: false,
			enabled: false,
			...config,
		},
		{},
	) as unknown as TestableWebVitalsInstrumentation

	instrumentation.isRecording = true
	instrumentation._tracer = {
		startSpan: vi.fn(() => span),
	}

	return { attributes, instrumentation, span }
}

async function reportLCPMetric(
	instrumentation: TestableWebVitalsInstrumentation,
	attributionOverrides: Partial<LCPMetricWithAttribution['attribution']> = {},
): Promise<void> {
	await instrumentation.reportMetric({
		metric: {
			attribution: {
				elementRenderDelay: 40,
				resourceLoadDelay: 20,
				resourceLoadDuration: 30,
				target: 'main>img',
				timeToFirstByte: 10,
				url: 'https://example.com/image.png',
				...attributionOverrides,
			},
			delta: 100,
			id: 'v5-lcp',
			navigationType: 'navigate',
			value: 100,
		} as LCPMetricWithAttribution,
		name: 'lcp',
	})
}
