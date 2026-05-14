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
import { afterEach, describe, expect, it } from 'vitest'

import {
	generateSafeWebVitalsTarget,
	getLCPResourceTimingAttributes,
	getLCPUrlForAttribution,
	getResolvedWebVitalsAttributionConfig,
	getWebVitalMetricReportKey,
	sanitizeLCPUrl,
	shouldExportWebVitalsTarget,
} from '../src/instrumentations/splunk-webvitals-instrumentation'

describe('webvitals attribution helpers', () => {
	afterEach(() => {
		document.body.innerHTML = ''
	})

	it('generates bounded structural targets without sensitive selectors', () => {
		const wrapper = document.createElement('section')
		wrapper.id = 'account-123'
		wrapper.className = 'secret-class'
		wrapper.dataset.userEmail = 'user@example.com'

		const button = document.createElement('button')
		button.id = 'pay-now'
		button.className = 'primary dangerous'
		button.setAttribute('aria-label', 'Pay as Jane Doe')
		button.setAttribute('role', 'button')
		button.textContent = 'Jane Doe'
		wrapper.append(button)
		document.body.append(wrapper)

		const target = generateSafeWebVitalsTarget(button)

		expect(target).toBe('button[role=button]')
		expect(target).not.toContain('pay-now')
		expect(target).not.toContain('primary')
		expect(target).not.toContain('user@example.com')
		expect(target).not.toContain('Jane')
		expect(target?.length).toBeLessThanOrEqual(120)
	})

	it('adds nth-of-type only when needed', () => {
		const list = document.createElement('ul')
		const first = document.createElement('li')
		const second = document.createElement('li')
		list.append(first, second)
		document.body.append(list)

		expect(generateSafeWebVitalsTarget(second)).toContain('li:nth-of-type(2)')
	})

	it('returns undefined for non-element inputs', () => {
		expect(generateSafeWebVitalsTarget(null)).toBeUndefined()
		expect(generateSafeWebVitalsTarget(document.createTextNode('hello'))).toBeUndefined()
	})

	it('stops walking once a safe role ancestor is reached', () => {
		const landmark = document.createElement('main')
		landmark.setAttribute('role', 'main')
		const region = document.createElement('section')
		const button = document.createElement('button')
		region.append(button)
		landmark.append(region)
		document.body.append(landmark)

		const target = generateSafeWebVitalsTarget(button)

		expect(target).toBe('main[role=main]>section>button')
	})

	it('keeps the leaf element when the depth cap is reached', () => {
		let parent = document.body
		const elements: HTMLElement[] = []
		for (let i = 0; i < 12; i++) {
			const next = document.createElement('div')
			parent.append(next)
			elements.push(next)
			parent = next
		}

		const leaf = elements.at(-1)!
		const target = generateSafeWebVitalsTarget(leaf)

		expectDefined(target)
		expect(target.split('>')).toHaveLength(6)
		expect(target.endsWith('div')).toBe(true)
	})

	it('never returns a mid-segment truncated selector', () => {
		const tag = 'super-long-custom-element-name'
		const ancestor = document.createElement(tag)
		let parent: HTMLElement = ancestor
		for (let i = 0; i < 5; i++) {
			const next = document.createElement(tag)
			parent.append(next)
			parent = next
		}
		document.body.append(ancestor)

		const target = generateSafeWebVitalsTarget(parent)

		expectDefined(target)
		expect(target.length).toBeLessThanOrEqual(120)
		for (const part of target.split('>')) {
			expect(part).toMatch(/^[a-z][a-z0-9-]*(\[role=[\w-]+\])?(:nth-of-type\(\d+\))?$/i)
		}
	})

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
		}

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
