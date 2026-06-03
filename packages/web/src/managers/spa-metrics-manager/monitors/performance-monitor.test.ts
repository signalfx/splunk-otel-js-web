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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ResourceState, ResourceStateEvent } from './monitor'
import { PerformanceMonitor } from './performance-monitor'

describe('PerformanceMonitor', () => {
	let monitor: PerformanceMonitor
	let events: ResourceStateEvent[]

	beforeEach(() => {
		events = []
		monitor = new PerformanceMonitor({
			ignoreUrls: [/ignore-me/],
			onResourceStateChange: (event) => events.push(event),
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
		// TODO: Replace with a local file once we have a test server
		link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'

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

		// Should have detected the CSS file
		const cssEvents = events.filter((e) => e.url.includes('bootstrap'))
		expect(cssEvents.length).toBeGreaterThan(0)
		expect(cssEvents[0].state).toBe(ResourceState.LOADED)
	})

	it('ignores URLs matching ignore pattern', async () => {
		monitor.start()

		// Create a style that would load an ignored URL
		const style = document.createElement('style')
		style.textContent = `
			.ignored-bg {
				background-image: url('https://example.com/ignore-me/image.png');
			}
		`
		document.head.append(style)

		await new Promise((resolve) => setTimeout(resolve, 50))

		style.remove()

		// Should not have any events for ignored URLs
		const ignoredEvents = events.filter((e) => e.url.includes('ignore-me'))
		expect(ignoredEvents.length).toBe(0)
	})
})
