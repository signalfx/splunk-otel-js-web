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

import { hrTimeToMilliseconds, timeInputToHrTime } from '@opentelemetry/core'
import { BasicTracerProvider, Span } from '@opentelemetry/sdk-trace-base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpaMetricsManager } from '../managers'

import { BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION } from '../managers/spa-metrics-manager/constants'
import { SplunkDocumentLoadInstrumentation } from './splunk-document-load-instrumentation'

class MockPerformanceObserver {
	static instances: MockPerformanceObserver[] = []

	readonly disconnect = vi.fn()

	readonly observe = vi.fn()

	constructor(private readonly callback: PerformanceObserverCallback) {
		MockPerformanceObserver.instances.push(this)
	}

	emit(entries: PerformanceEntry[]): void {
		this.callback(
			{
				getEntries: () => entries,
				getEntriesByName: (name: string) => entries.filter((entry) => entry.name === name),
				getEntriesByType: (type: string) => entries.filter((entry) => entry.entryType === type),
			},
			this as unknown as PerformanceObserver,
		)
	}
}

describe('SplunkDocumentLoadInstrumentation', () => {
	let instrumentation: SplunkDocumentLoadInstrumentation | undefined

	beforeEach(() => {
		MockPerformanceObserver.instances = []
	})

	afterEach(() => {
		instrumentation?.disable()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('starts and registers pageLoad when a buffered navigation entry becomes available', () => {
		const setCurrentNavigationSpan = vi.fn()
		const spaMetricsManager = {
			getNavigationPageAttributes: vi.fn(() => {}),
			setCurrentNavigationSpan,
			waitForPageLoad: vi.fn(() => new Promise(() => {})),
		} as unknown as SpaMetricsManager
		vi.spyOn(performance, 'getEntriesByType').mockReturnValue([])
		vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)

		instrumentation = new SplunkDocumentLoadInstrumentation(
			{},
			{ experimental: true },
			undefined,
			spaMetricsManager,
		)
		instrumentation.setTracerProvider(new BasicTracerProvider())

		expect(MockPerformanceObserver.instances).toHaveLength(1)
		expect(MockPerformanceObserver.instances[0].observe).toHaveBeenCalledWith({
			buffered: true,
			type: 'navigation',
		})
		expect(setCurrentNavigationSpan).not.toHaveBeenCalled()

		const fetchStart = 12.5
		MockPerformanceObserver.instances[0].emit([
			{
				entryType: 'navigation',
				fetchStart,
				name: location.href,
			} as PerformanceNavigationTiming,
		])

		expect(setCurrentNavigationSpan).toHaveBeenCalledTimes(1)
		const [pageLoadSpan, startTime, operation] = setCurrentNavigationSpan.mock.calls[0] as [Span, number, string]
		expect(pageLoadSpan.name).toBe('pageLoad')
		expect(hrTimeToMilliseconds(pageLoadSpan.startTime)).toBe(hrTimeToMilliseconds(timeInputToHrTime(fetchStart)))
		expect(startTime).toBe(0)
		expect(operation).toBe(BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION)
		expect(MockPerformanceObserver.instances[0].disconnect).toHaveBeenCalledOnce()

		pageLoadSpan.end()
	})
})
