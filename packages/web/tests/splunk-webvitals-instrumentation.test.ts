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

import { expectDefined } from '@test-utils/assertions'
import { describe, expect, it } from 'vitest'

import {
	getLCPResourceTimingAttributes,
	getLCPUrlForAttribution,
	getResolvedWebVitalsAttributionConfig,
	getWebVitalMetricReportKey,
	sanitizeLCPUrl,
	shouldExportWebVitalsTarget,
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
		expect(getResolvedWebVitalsAttributionConfig({ target: 'raw' })).toEqual({
			lcpUrl: 'sanitized',
			target: 'raw',
		})
		expect(getResolvedWebVitalsAttributionConfig({ lcpUrl: 'off' })).toEqual({
			lcpUrl: 'off',
			target: 'safe',
		})
	})

	it('applies target and LCP URL attribution policy defaults and overrides', () => {
		const fullUrl = 'https://example.com/path/image.png?token=secret#fragment'

		expect(shouldExportWebVitalsTarget()).toBe(true)
		expect(shouldExportWebVitalsTarget({ target: 'raw' })).toBe(true)
		expect(shouldExportWebVitalsTarget({ target: 'off' })).toBe(false)
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
})
