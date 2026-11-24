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

import { type Span } from '@opentelemetry/api'
import { describe, expect, it, vi } from 'vitest'

import {
	BROWSER_RESOURCE_SERVICE_WORKER_USED_ATTRIBUTE,
	BROWSER_RESOURCE_TIMING_UNAVAILABLE_REASON_ATTRIBUTE,
	getCrossOriginTimingRestricted,
	getResourceTimingUnavailableReason,
	observeResourceTimingBufferFull,
	setResourceTimingDiagnostics,
	setResourceTimingRenderBlocking,
} from './resource-timing'

describe('getCrossOriginTimingRestricted', () => {
	it('returns true when a cross-origin entry has hidden request and response timing and zero sizes', () => {
		expect(getCrossOriginTimingRestricted(createResourceEntry())).toBe(true)
	})

	it('returns false when a cross-origin entry exposes request and response timing', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({
					requestStart: 10,
					responseStart: 12,
				}),
			),
		).toBe(false)
	})

	it('omits the result for same-origin resources', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({ name: new URL('/resource.svg', self.origin).toString() }),
			),
		).toBeUndefined()
	})

	it('omits the result when timing and size fields have mixed signals', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({
					requestStart: 0,
					responseStart: 12,
				}),
			),
		).toBeUndefined()
	})

	it('omits the result when hidden timing is not corroborated by all zero sizes', () => {
		expect(
			getCrossOriginTimingRestricted(
				createResourceEntry({
					decodedBodySize: 100,
				}),
			),
		).toBeUndefined()
	})

	it('omits the result when a required timing or size field is unavailable', () => {
		expect(getCrossOriginTimingRestricted(createResourceEntry({ encodedBodySize: undefined }))).toBeUndefined()
	})

	it('omits the result for non-HTTP resources', () => {
		expect(
			getCrossOriginTimingRestricted(createResourceEntry({ name: 'data:text/plain,resource' })),
		).toBeUndefined()
	})
})

describe('setResourceTimingRenderBlocking', () => {
	it.each(['blocking', 'non-blocking'] as const)('sets the resource.render_blocking attribute to %s', (status) => {
		const setAttribute = vi.fn()
		const span = { setAttribute } as unknown as Span
		const resource = { renderBlockingStatus: status } as unknown as PerformanceResourceTiming & {
			readonly renderBlockingStatus?: string
		}

		setResourceTimingRenderBlocking(span, resource)

		expect(setAttribute).toHaveBeenCalledExactlyOnceWith('resource.render_blocking', status)
	})

	it.each([undefined, 'ineligible', 'unknown'] as const)('does not set an attribute for %s status', (status) => {
		const setAttribute = vi.fn()
		const span = { setAttribute } as unknown as Span
		const resource = { renderBlockingStatus: status } as unknown as PerformanceResourceTiming & {
			readonly renderBlockingStatus?: string
		}

		setResourceTimingRenderBlocking(span, resource)

		expect(setAttribute).not.toHaveBeenCalled()
	})
})

describe('resource timing diagnostics', () => {
	it('identifies TAO-restricted timing without guessing about its cause', () => {
		expect(getResourceTimingUnavailableReason(createResourceEntry())).toBe('cross_origin_timing_restricted')
	})

	it('identifies an opaque fetch response directly', () => {
		expect(getResourceTimingUnavailableReason(undefined, { opaqueResponse: true })).toBe('opaque_response')
	})

	it('identifies Service Worker participation when workerStart is visible', () => {
		const resource = createResourceEntry({
			name: new URL('/resource.svg', self.origin).toString(),
			requestStart: 0,
			responseStart: 0,
			workerStart: 4,
		})
		const setAttribute = vi.fn()

		expect(getResourceTimingUnavailableReason(resource)).toBe('service_worker')
		setResourceTimingDiagnostics({ setAttribute } as unknown as Span, resource)
		expect(setAttribute).toHaveBeenCalledWith(BROWSER_RESOURCE_SERVICE_WORKER_USED_ATTRIBUTE, true)
		expect(setAttribute).toHaveBeenCalledWith(
			BROWSER_RESOURCE_TIMING_UNAVAILABLE_REASON_ATTRIBUTE,
			'service_worker',
		)
	})

	it('identifies a cache hit only when timing phases are unavailable', () => {
		const resource = createResourceEntry({
			name: new URL('/resource.svg', self.origin).toString(),
			requestStart: 0,
			responseStart: 0,
		})
		expect(getResourceTimingUnavailableReason(resource, { cacheHit: true })).toBe('cache')
		expect(
			getResourceTimingUnavailableReason(
				{
					...resource,
					requestStart: 10,
					responseStart: 12,
				},
				{ cacheHit: true },
			),
		).toBeUndefined()
	})

	it('uses generic reasons when the entry is missing or has no timing phases', () => {
		expect(getResourceTimingUnavailableReason()).toBe('resource_timing_entry_missing')
		expect(
			getResourceTimingUnavailableReason(
				createResourceEntry({
					name: new URL('/resource.svg', self.origin).toString(),
				}),
			),
		).toBe('timing_details_missing')
	})

	it('reports recent Resource Timing buffer exhaustion for an uncorrelated request', () => {
		observeResourceTimingBufferFull()
		window.performance.dispatchEvent(new Event('resourcetimingbufferfull'))
		expect(getResourceTimingUnavailableReason()).toBe('resource_timing_buffer_full')
	})
})

function createResourceEntry(overrides: Partial<PerformanceResourceTiming> = {}): PerformanceResourceTiming {
	return {
		decodedBodySize: 0,
		encodedBodySize: 0,
		name: 'https://cdn.example.test/resource.svg',
		requestStart: 0,
		responseStart: 0,
		transferSize: 0,
		...overrides,
	} as PerformanceResourceTiming
}
