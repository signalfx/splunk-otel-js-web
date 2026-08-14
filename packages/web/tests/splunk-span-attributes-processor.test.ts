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

import {
	AlwaysOffSampler,
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { describe, expect, it } from 'vitest'

import { NavigationMetricsManager, SessionManager, StorageManager, UserManager } from '../src/managers'
import {
	BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION,
	BROWSER_NAVIGATION_OPERATION_ATTRIBUTE,
	BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION,
} from '../src/managers/navigation-metrics-manager/constants'
import { SpanAttributesProcessor } from '../src/span-processors'

describe('SplunkSpanAttributesProcessor', () => {
	const storageManager = new StorageManager({
		persistence: 'cookie',
	})
	const userManager = new UserManager('anonymousTracking', storageManager)
	const sessionManager = new SessionManager(storageManager)

	describe('setting global attribute', () => {
		it('should set attributes via constructor', () => {
			const processor = new SpanAttributesProcessor(sessionManager, userManager, {
				key1: 'value1',
			})

			expect(processor.getGlobalAttributes()).toStrictEqual({
				key1: 'value1',
			})
		})

		it('should patch attributes via .setGlobalAttributes()', () => {
			const processor = new SpanAttributesProcessor(sessionManager, userManager, {
				key1: 'value1',
				key2: 'value2',
			})

			processor.setGlobalAttributes({
				key2: 'value2-updated',
				key3: 'value3',
			})

			expect(processor.getGlobalAttributes()).toStrictEqual({
				key1: 'value1',
				key2: 'value2-updated',
				key3: 'value3',
			})
		})

		it('does not overwrite an existing location.href attribute on span start', async () => {
			const processor = new SpanAttributesProcessor(sessionManager, userManager, {}, true, false)
			const { exporter, provider, tracer } = createTestTracer(processor)
			const span = tracer.startSpan('captured-route', {
				attributes: { 'location.href': 'https://example.com/captured-route' },
			})
			span.end()
			await provider.forceFlush()

			expect(exporter.getFinishedSpans()[0].attributes['location.href']).toBe(
				'https://example.com/captured-route',
			)
		})

		it('does not overwrite an existing navigation operation on span start', async () => {
			const navigationMetricsManager = new NavigationMetricsManager()
			const processor = new SpanAttributesProcessor(
				sessionManager,
				userManager,
				{},
				true,
				false,
				navigationMetricsManager,
			)
			const { exporter, provider, tracer } = createTestTracer(processor)
			const span = tracer.startSpan(BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION, {
				attributes: {
					[BROWSER_NAVIGATION_OPERATION_ATTRIBUTE]: BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION,
				},
			})
			span.end()
			await provider.forceFlush()

			expect(exporter.getFinishedSpans()[0].attributes[BROWSER_NAVIGATION_OPERATION_ATTRIBUTE]).toBe(
				BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION,
			)
		})

		it('sets the navigation operation that was active at the span start time', async () => {
			const navigationMetricsManager = new NavigationMetricsManager()
			const processor = new SpanAttributesProcessor(
				sessionManager,
				userManager,
				{},
				true,
				false,
				navigationMetricsManager,
			)
			const { exporter, provider, tracer } = createTestTracer(processor)
			const navigationSpan = tracer.startSpan(BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION, {
				startTime: performance.timeOrigin + 100,
			})
			navigationMetricsManager.setCurrentNavigationSpan(
				navigationSpan,
				100,
				BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION,
			)
			const routeChangeSpan = tracer.startSpan(BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION, {
				startTime: performance.timeOrigin + 200,
			})
			navigationMetricsManager.setCurrentNavigationSpan(
				routeChangeSpan,
				200,
				BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION,
			)

			const documentLoadSpan = tracer.startSpan('document-load-span', {
				startTime: performance.timeOrigin + 150,
			})
			const routeChangeOperationSpan = tracer.startSpan('route-change-span', {
				startTime: performance.timeOrigin + 250,
			})
			documentLoadSpan.end()
			routeChangeOperationSpan.end()
			navigationSpan.end()
			routeChangeSpan.end()
			await provider.forceFlush()

			const documentLoadAttributes = exporter
				.getFinishedSpans()
				.find((span) => span.name === 'document-load-span')?.attributes
			const routeChangeAttributes = exporter
				.getFinishedSpans()
				.find((span) => span.name === 'route-change-span')?.attributes

			expect(documentLoadAttributes?.[BROWSER_NAVIGATION_OPERATION_ATTRIBUTE]).toBe(
				BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION,
			)
			expect(routeChangeAttributes?.[BROWSER_NAVIGATION_OPERATION_ATTRIBUTE]).toBe(
				BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION,
			)
		})

		it('attributes sampled spans after a sampled-out routeChange span without a name', async () => {
			const navigationMetricsManager = new NavigationMetricsManager()
			const processor = new SpanAttributesProcessor(
				sessionManager,
				userManager,
				{},
				true,
				false,
				navigationMetricsManager,
			)
			const { exporter, provider, tracer } = createTestTracer(processor)
			const sampledOutProvider = new BasicTracerProvider({ sampler: new AlwaysOffSampler() })
			const sampledOutRouteChangeSpan = sampledOutProvider
				.getTracer('sampled-out-route-change-test')
				.startSpan(BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION, { startTime: performance.timeOrigin + 200 })

			expect('name' in sampledOutRouteChangeSpan).toBe(false)
			navigationMetricsManager.setCurrentNavigationSpan(
				sampledOutRouteChangeSpan,
				200,
				BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION,
			)

			const sampledSpan = tracer.startSpan('sampled-after-route-change', {
				startTime: performance.timeOrigin + 250,
			})
			sampledSpan.end()
			await provider.forceFlush()
			await sampledOutProvider.shutdown()

			const attributes = exporter
				.getFinishedSpans()
				.find((span) => span.name === 'sampled-after-route-change')?.attributes

			expect(attributes?.[BROWSER_NAVIGATION_OPERATION_ATTRIBUTE]).toBe(BROWSER_NAVIGATION_ROUTE_CHANGE_OPERATION)
		})
	})
})

function createTestTracer(processor: SpanAttributesProcessor) {
	const exporter = new InMemorySpanExporter()
	const provider = new BasicTracerProvider()
	provider.addSpanProcessor(processor)
	provider.addSpanProcessor(new SimpleSpanProcessor(exporter))

	return {
		exporter,
		provider,
		tracer: provider.getTracer('span-attributes-processor-test'),
	}
}
