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

import { MediaMonitor } from './media-monitor'
import { ResourceState, ResourceStateEvent } from './monitor'

describe('MediaMonitor', () => {
	let monitor: MediaMonitor
	let events: ResourceStateEvent[]

	beforeEach(() => {
		events = []
		monitor = new MediaMonitor({
			ignoreUrls: [/ignore-me/],
			onResourceStateChange: (event) => events.push(event),
		})
	})

	afterEach(() => {
		monitor.stop()
		// Clean up any added elements
		document.body.querySelectorAll('img, video, audio').forEach((el) => el.remove())
	})

	describe('images', () => {
		it('tracks dynamically added images', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
			document.body.append(img)

			// Wait for MutationObserver and load event
			await new Promise<void>((resolve) => {
				img.addEventListener('load', () => resolve())
				img.addEventListener('error', () => resolve())
			})

			await new Promise((resolve) => setTimeout(resolve, 0))

			// Data URLs load very fast - may be already loaded when MutationObserver runs
			// If already loaded: single LOADED event; otherwise: DISCOVERED + LOADED
			expect(events.length).toBeGreaterThanOrEqual(1)
			const lastEvent = events.at(-1)
			expect(lastEvent?.state).toBe(ResourceState.LOADED)
			expect(lastEvent).toHaveProperty('loadTime')
		})

		it('ignores URLs matching pattern', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.src = 'https://example.com/ignore-me/image.gif'
			document.body.append(img)

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(events.length).toBe(0)
		})

		it('detects already loaded images', async () => {
			// Create and load image before starting monitor
			const img = document.createElement('img')
			img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
			document.body.append(img)

			await new Promise<void>((resolve) => {
				img.addEventListener('load', () => resolve())
				img.addEventListener('error', () => resolve())
			})

			// Start monitor after image is loaded
			monitor.start()
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Should detect as already loaded (single LOADED event with loadTime: 0)
			expect(events.length).toBe(1)
			expect(events[0].state).toBe(ResourceState.LOADED)
			expect('loadTime' in events[0] && events[0].loadTime).toBe(0)
		})
	})

	describe('nested elements', () => {
		it('tracks media elements added inside containers', async () => {
			monitor.start()

			const container = document.createElement('div')
			const img = document.createElement('img')
			img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
			container.append(img)
			document.body.append(container)

			// Wait for MutationObserver and load event
			await new Promise<void>((resolve) => {
				img.addEventListener('load', () => resolve())
				img.addEventListener('error', () => resolve())
			})
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Data URLs load very fast - may be already loaded when MutationObserver runs
			expect(events.length).toBeGreaterThanOrEqual(1)
			const lastEvent = events.at(-1)
			expect(lastEvent?.state).toBe(ResourceState.LOADED)
		})
	})

	describe('start/stop', () => {
		it('stops tracking after stop()', async () => {
			monitor.start()
			monitor.stop()

			const img = document.createElement('img')
			img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
			document.body.append(img)

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(events.length).toBe(0)
		})
	})
})
