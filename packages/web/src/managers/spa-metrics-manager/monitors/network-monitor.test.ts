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

import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HTTP_TEST_SERVER_URL } from '@test-server/http-constants'
import { createWebTracerProvider } from '@web-test-utils/web-tracer-provider'
import { SplunkFetchInstrumentation, SplunkXhrInstrumentation } from '@web/instrumentations'
import { SpanEmitterProcessor } from '@web/span-processors'
import type { SplunkOtelWebConfig } from '@web/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourceState, ResourceStateEvent } from './monitor'
import { NetworkMonitor } from './network-monitor'

const TEST_URL = 'https://example.test/api'
const WAIT_FOR_INSTRUMENTATION_MS = 500

function createTestUrl(resource: string): string {
	return `${HTTP_TEST_SERVER_URL}/some-data?resource=${resource}-${Date.now()}-${Math.random()}`
}

function waitForInstrumentation(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, WAIT_FOR_INSTRUMENTATION_MS))
}

describe('NetworkMonitor', () => {
	let monitor: NetworkMonitor
	let events: ResourceStateEvent[]
	let tracerProvider: ReturnType<typeof createWebTracerProvider>
	let spanEmitter: SpanEmitterProcessor
	let unregisterInstrumentations: () => void

	beforeEach(() => {
		events = []
		spanEmitter = new SpanEmitterProcessor()
		spanEmitter.enable()
		tracerProvider = createWebTracerProvider({ spanProcessors: [spanEmitter] })

		const otelConfig: SplunkOtelWebConfig = { spanEmitter }
		unregisterInstrumentations = registerInstrumentations({
			instrumentations: [
				new SplunkFetchInstrumentation({}, otelConfig),
				new SplunkXhrInstrumentation({}, otelConfig),
			],
			tracerProvider,
		})
		monitor = new NetworkMonitor({
			onResourceStateChange: (event) => events.push(event),
			spanEmitter,
		})
		monitor.start()
	})

	afterEach(async () => {
		monitor.stop()
		unregisterInstrumentations()
		await tracerProvider.shutdown()
		await spanEmitter.shutdown()
	})

	describe('fetch', () => {
		it('tracks fetch requests', async () => {
			const url = `${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=fetch-track`

			await fetch(url)

			await vi.waitFor(() => expect(events).toHaveLength(2), { timeout: 2000 })
			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[0].url).toBe(url)
			expect(events[0].id).toMatch(/^fetch:/)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[1].url).toBe(url)
			expect(events[1]).toHaveProperty('loadTime')
			expect(events[0].id).toBe(events[1].id)
		})

		it('emits URLs matching ignore patterns because SpaMetricsManager applies ignoreUrls', async () => {
			await fetch(`${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=ignore-me-test`)

			await vi.waitFor(() => expect(events).toHaveLength(2), { timeout: 2000 })
			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})

		it('tracks data URL requests', async () => {
			await fetch('data:text/plain,hello')

			await vi.waitFor(() => expect(events).toHaveLength(2), { timeout: 2000 })
			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})
	})

	describe('XHR', () => {
		it('tracks XHR requests', async () => {
			const url = `${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=xhr-track`

			await new Promise<void>((resolve) => {
				const xhr = new XMLHttpRequest()
				xhr.open('GET', url)
				xhr.addEventListener('load', () => resolve())
				xhr.addEventListener('error', () => resolve())
				xhr.send()
			})

			// Allow microtasks to complete so monitor's event handlers are processed
			await vi.waitFor(() => expect(events).toHaveLength(2), { timeout: 2000 })

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[0].url).toBe(url)
			expect(events[0].id).toMatch(/^xml-http-request:/)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[1].url).toBe(url)
			expect(events[1]).toHaveProperty('loadTime')
			expect(events[0].id).toBe(events[1].id)
		})

		it('emits URLs matching ignore patterns because SpaMetricsManager applies ignoreUrls', async () => {
			await new Promise<void>((resolve) => {
				const xhr = new XMLHttpRequest()
				xhr.open('GET', `${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=ignore-me-test`)
				xhr.addEventListener('load', () => resolve())
				xhr.addEventListener('error', () => resolve())
				xhr.send()
			})

			// Allow microtasks to complete so monitor's event handlers are processed
			await vi.waitFor(() => expect(events).toHaveLength(2), { timeout: 2000 })

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})
	})

	describe('span events', () => {
		it('ignores spans without a string URL', () => {
			const tracer = tracerProvider.getTracer('network-monitor-test')
			tracer.startSpan('missing url', { attributes: { component: 'fetch' } }).end()
			tracer.startSpan('non-string url', { attributes: { 'component': 'fetch', 'http.url': 123 } }).end()

			expect(events).toEqual([])
		})

		it('converts span timestamps to performance.now-relative time', () => {
			const tracer = tracerProvider.getTracer('network-monitor-test')
			const span = tracer.startSpan('HTTP GET', {
				attributes: { 'component': 'fetch', 'http.url': TEST_URL },
				startTime: performance.timeOrigin + 100,
			})

			span.end(performance.timeOrigin + 125)

			const discoveredEvent = events.find((event) => event.state === ResourceState.DISCOVERED)
			expect(discoveredEvent).toBeDefined()
			expect(discoveredEvent?.timestamp).toBeCloseTo(100, 5)

			const loadedEvent = events.find((event) => event.state === ResourceState.LOADED)
			expect(loadedEvent).toMatchObject({
				loadTime: expect.closeTo(25, 5),
				state: ResourceState.LOADED,
				timestamp: expect.closeTo(125, 5),
			})
		})
	})

	describe('start/stop', () => {
		it('stops tracking after stop()', async () => {
			const url = createTestUrl('network-monitor-stopped')

			monitor.stop()

			await fetch(url)
			await waitForInstrumentation()

			expect(events).toEqual([])
		})

		it('restarts monitoring', async () => {
			const url = createTestUrl('network-monitor-restarted')

			monitor.stop()
			monitor.start()
			await fetch(url)

			await vi.waitFor(() => expect(events).toHaveLength(2), { timeout: 2000 })
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})
	})
})
