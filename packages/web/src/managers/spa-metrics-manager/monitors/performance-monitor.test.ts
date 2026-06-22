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

import { HTTP_TEST_SERVER_URL } from '@test-server/http-constants'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SpanEmitterProcessor } from '../../../span-processors'
import { ResourceState, ResourceStateEvent } from './monitor'
import { PerformanceMonitor } from './performance-monitor'

const TEST_IMAGE_URL = `${HTTP_TEST_SERVER_URL}/test-image.png`
const TEST_IGNORED_IMAGE_URL = `${TEST_IMAGE_URL}?resource=ignore-me-image`
const TEST_STYLE_URL = `${HTTP_TEST_SERVER_URL}/style.css`

describe('PerformanceMonitor', () => {
	let monitor: PerformanceMonitor
	let events: ResourceStateEvent[]

	beforeEach(() => {
		events = []
		monitor = new PerformanceMonitor({
			onResourceStateChange: (event) => events.push(event),
			spanEmitter: new SpanEmitterProcessor(),
		})
	})

	afterEach(() => {
		monitor.stop()
	})

	it('starts and stops without error', () => {
		expect(() => monitor.start()).not.toThrow()
		expect(() => monitor.stop()).not.toThrow()
	})

	it('can be started multiple times safely', () => {
		monitor.start()
		expect(() => monitor.start()).not.toThrow()
		monitor.stop()
	})

	it('can be stopped multiple times safely', () => {
		monitor.start()
		monitor.stop()
		expect(() => monitor.stop()).not.toThrow()
	})

	it('detects CSS resources via performance observer', async () => {
		monitor.start()

		const link = document.createElement('link')
		link.rel = 'stylesheet'
		link.href = TEST_STYLE_URL

		const loadPromise = new Promise<void>((resolve) => {
			link.addEventListener('load', () => resolve())
			link.addEventListener('error', () => resolve())
		})

		document.head.append(link)
		await loadPromise

		// Wait for performance observer to process
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Clean up
		link.remove()

		// Should have detected the CSS file (DISCOVERED + LOADED)
		const cssEvents = events.filter((e) => e.url === TEST_STYLE_URL)
		expect(cssEvents.length).toBeGreaterThanOrEqual(2)
		expect(cssEvents[0].state).toBe(ResourceState.DISCOVERED)
		expect(cssEvents[1].state).toBe(ResourceState.LOADED)
		expect(cssEvents[0].id).toBe(cssEvents[1].id)
	})

	it('emits URLs matching ignore patterns because SpaMetricsManager applies ignoreUrls', () => {
		// @ts-expect-error handleResourceEntry is private. We use it for focused monitor testing.
		monitor.handleResourceEntry({
			initiatorType: 'img',
			name: TEST_IGNORED_IMAGE_URL,
			responseEnd: 1,
			startTime: 0,
		})

		const ignoredEvents = events.filter((e) => e.url.includes('ignore-me'))
		expect(ignoredEvents).toHaveLength(2)
		expect(ignoredEvents[0].state).toBe(ResourceState.DISCOVERED)
		expect(ignoredEvents[1].state).toBe(ResourceState.LOADED)
		expect(ignoredEvents[0].id).toBe(ignoredEvents[1].id)
	})

	it('tracks data URL resource entries', () => {
		// @ts-expect-error handleResourceEntry is private. We use it for focused monitor testing.
		monitor.handleResourceEntry({
			initiatorType: 'img',
			name: 'data:image/png;base64,abc',
			responseEnd: 1,
			startTime: 0,
		})

		expect(events).toHaveLength(2)
		expect(events[0].state).toBe(ResourceState.DISCOVERED)
		expect(events[1].state).toBe(ResourceState.LOADED)
		expect(events[0].id).toBe(events[1].id)
	})

	it('uses the resource timing responseEnd as the loaded timestamp', () => {
		// @ts-expect-error handleResourceEntry is private. We use it for focused monitor testing.
		monitor.handleResourceEntry({
			initiatorType: 'img',
			name: TEST_IMAGE_URL,
			responseEnd: 1234,
			startTime: 1000,
		})

		expect(events).toHaveLength(2)
		expect(events[0].id).toBe(events[1].id)
		expect(events[1]).toMatchObject({
			loadTime: 234,
			state: ResourceState.LOADED,
			timestamp: 1234,
			url: TEST_IMAGE_URL,
		})
	})
})
