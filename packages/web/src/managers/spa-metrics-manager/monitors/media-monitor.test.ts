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

import { HTTP_TEST_SERVER_URL } from '@test-kit/servers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MediaMonitor } from './media-monitor'
import { ResourceState, ResourceStateEvent } from './monitor'
import { expectEventStatesWithMatchingIds } from './monitor-test-utils'

const DATA_IMAGE_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const getFailedImageUrl = (resource: string, delay = 20) =>
	`${HTTP_TEST_SERVER_URL}/test-image-error.png?delay=${delay}&resource=${resource}`
const getTestImageUrl = (resource: string, delay = 20) =>
	`${HTTP_TEST_SERVER_URL}/test-image.png?delay=${delay}&resource=${resource}`
const waitForImageLoad = (img: HTMLImageElement) =>
	new Promise<void>((resolve, reject) => {
		img.addEventListener('load', () => resolve(), { once: true })
		img.addEventListener('error', () => reject(new Error(`Image failed to load: ${img.src}`)), { once: true })
	})
const waitForMutationObserver = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('MediaMonitor', () => {
	let monitor: MediaMonitor
	let events: ResourceStateEvent[]

	beforeEach(() => {
		events = []
		monitor = new MediaMonitor({
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
			img.src = getTestImageUrl('dynamic-image')
			document.body.append(img)

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
			})
		})

		it('marks failed images as errored', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.src = getFailedImageUrl('failing-image')
			document.body.append(img)

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.ERROR])
			})
		})

		it('marks removed loading images as errored', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.src = getTestImageUrl('removed-image', 250)
			document.body.append(img)

			await vi.waitFor(() => {
				expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED])
			})
			img.remove()

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.ERROR])
			})
		})

		it('skips images without a source', async () => {
			monitor.start()

			const img = document.createElement('img')
			document.body.append(img)

			await waitForMutationObserver()

			expect(events).toHaveLength(0)
		})

		it('tracks data URL images', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.src = DATA_IMAGE_URL
			document.body.append(img)

			await vi.waitFor(() => {
				expect(events.length).toBeGreaterThan(0)
			})
			expect(events.every((event) => event.url === DATA_IMAGE_URL)).toBe(true)
		})

		it('tracks images when the source is set after insertion', async () => {
			monitor.start()

			const img = document.createElement('img')
			document.body.append(img)
			await waitForMutationObserver()

			img.src = getTestImageUrl('late-source-image')

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
			})
		})

		it('releases the previous image resource when the source changes during load', async () => {
			monitor.start()

			const firstUrl = getTestImageUrl('first-image', 250)
			const secondUrl = getTestImageUrl('second-image', 20)
			const img = document.createElement('img')

			img.src = firstUrl
			document.body.append(img)

			await vi.waitFor(() => {
				expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED])
			})

			img.src = secondUrl

			await vi.waitFor(() => {
				expect(events.some((event) => event.state === ResourceState.ERROR && event.url === firstUrl)).toBe(true)
				expect(
					events.some((event) => event.state === ResourceState.DISCOVERED && event.url === secondUrl),
				).toBe(true)
				expect(events.some((event) => event.state === ResourceState.LOADED && event.url === secondUrl)).toBe(
					true,
				)
			})

			const firstEvents = events.filter((event) => event.url === firstUrl)
			const secondEvents = events.filter((event) => event.url === secondUrl)
			expectEventStatesWithMatchingIds(firstEvents, [ResourceState.DISCOVERED, ResourceState.ERROR])
			expectEventStatesWithMatchingIds(secondEvents, [ResourceState.DISCOVERED, ResourceState.LOADED])
			expect(firstEvents[0].id).not.toBe(secondEvents[0].id)
		})

		it('emits URLs matching ignore patterns because SpaMetricsManager applies ignoreUrls', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.src = getTestImageUrl('ignore-me-image')
			document.body.append(img)

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
			})
		})

		it('detects already loaded images', async () => {
			// Create and load image before starting monitor
			const img = document.createElement('img')
			const imageLoaded = waitForImageLoad(img)
			img.src = getTestImageUrl('already-loaded-image')
			document.body.append(img)
			await imageLoaded

			// Start monitor after image is loaded
			monitor.start()
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Should detect as already loaded (single LOADED event with loadTime: 0)
			expect(events.length).toBe(1)
			expect(events[0].state).toBe(ResourceState.LOADED)
			expect('loadTime' in events[0] && events[0].loadTime).toBe(0)
		})

		it('skips lazy-loaded images', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.loading = 'lazy'
			img.src = getTestImageUrl('lazy-image')
			document.body.append(img)

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(events.length).toBe(0)
		})

		it('tracks eager-loaded images (loading="eager")', async () => {
			monitor.start()

			const img = document.createElement('img')
			img.loading = 'eager'
			img.src = getTestImageUrl('eager-image')
			document.body.append(img)

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
			})
		})

		it('tracks images without loading attribute', async () => {
			monitor.start()

			const img = document.createElement('img')
			// No loading attribute set (default behavior)
			img.src = getTestImageUrl('no-loading-attribute-image')
			document.body.append(img)

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
			})
		})

		it('skips existing lazy-loaded images when monitor starts', async () => {
			// Create lazy image before starting monitor
			const img = document.createElement('img')
			img.loading = 'lazy'
			img.src = getTestImageUrl('existing-lazy-image')
			document.body.append(img)

			await new Promise((resolve) => setTimeout(resolve, 50))

			// Start monitor after lazy image exists
			monitor.start()
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Should not track the lazy image
			expect(events.length).toBe(0)
		})
	})

	describe('nested elements', () => {
		it('tracks media elements added inside containers', async () => {
			monitor.start()

			const container = document.createElement('div')
			const img = document.createElement('img')
			img.src = getTestImageUrl('nested-image')
			container.append(img)
			document.body.append(container)

			await vi.waitFor(() => {
				expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
			})
		})
	})

	describe('start/stop', () => {
		it('stops tracking after stop()', async () => {
			monitor.start()
			monitor.stop()

			const img = document.createElement('img')
			img.src = getTestImageUrl('after-stop-image')
			document.body.append(img)

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(events.length).toBe(0)
		})
	})
})
