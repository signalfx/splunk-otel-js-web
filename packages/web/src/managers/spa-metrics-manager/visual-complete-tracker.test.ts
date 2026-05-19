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

import { afterEach, describe, expect, it } from 'vitest'

import { MediaMonitor } from './monitors'
import { VisualCompleteTracker } from './visual-complete-tracker'

const QUIET_MEDIA_TIME = 10

type ImageLayout = {
	height?: number
	left?: number
	top?: number
	width?: number
}

function createImage(layout: ImageLayout = {}): HTMLImageElement {
	const image = document.createElement('img')
	Object.defineProperty(image, 'complete', { configurable: true, get: () => false })

	image.style.display = 'block'
	image.style.height = `${layout.height ?? 100}px`
	image.style.left = `${layout.left ?? 0}px`
	image.style.position = 'absolute'
	image.style.top = `${layout.top ?? 0}px`
	image.style.width = `${layout.width ?? 100}px`

	return image
}

describe('VisualCompleteTracker', () => {
	let monitor: MediaMonitor

	afterEach(() => {
		monitor?.stop()
		document.body.querySelectorAll('img, video').forEach((element) => element.remove())
		window.scrollTo(0, 0)
	})

	function createTracker(): VisualCompleteTracker {
		monitor = new MediaMonitor({
			onResourceStateChange: () => {},
		})
		monitor.start()

		return new VisualCompleteTracker({
			mediaMonitor: monitor,
			quietMediaTime: QUIET_MEDIA_TIME,
		})
	}

	it('resolves vct for an image in the initial viewport', async () => {
		const image = createImage()
		document.body.append(image)

		const tracker = createTracker()
		const promise = tracker.start({ startTime: performance.now() })
		image.dispatchEvent(new Event('load'))

		const result = await promise
		expect(result.vct).toBeDefined()
		expect(result.vct ?? -1).toBeGreaterThanOrEqual(0)
	})

	it('tracks lazy images when they intersect the initial viewport', async () => {
		const image = createImage()
		image.loading = 'lazy'
		document.body.append(image)

		const tracker = createTracker()
		const promise = tracker.start({ startTime: performance.now() })
		image.dispatchEvent(new Event('load'))

		const result = await promise
		expect(result.vct).toBeDefined()
	})

	it('omits vct when first-viewport candidates are not detected', async () => {
		const image = createImage({ top: window.innerHeight + 100 })
		document.body.append(image)

		const tracker = createTracker()
		const promise = tracker.start({ startTime: performance.now() })
		image.dispatchEvent(new Event('load'))

		const result = await promise
		expect(result.vct).toBeUndefined()
	})

	it('tracks media added to the initial viewport before media quiet time expires', async () => {
		const tracker = createTracker()
		const promise = tracker.start({ startTime: performance.now() })

		const image = createImage()
		document.body.append(image)
		await new Promise((resolve) => setTimeout(resolve, 0))
		image.dispatchEvent(new Event('load'))

		const result = await promise
		expect(result.vct).toBeDefined()
	})

	it('does not track media added after media quiet time expires', async () => {
		const tracker = createTracker()
		const promise = tracker.start({ startTime: performance.now() })

		const result = await promise

		const image = createImage()
		document.body.append(image)
		await new Promise((resolve) => setTimeout(resolve, 0))
		image.dispatchEvent(new Event('load'))

		expect(result.vct).toBeUndefined()
	})

	it('completes previous measurement when started again', async () => {
		const tracker = createTracker()
		const firstPromise = tracker.start({ startTime: performance.now() })
		const image = createImage()
		document.body.append(image)
		await new Promise((resolve) => setTimeout(resolve, 0))

		const secondPromise = tracker.start({ startTime: performance.now() })
		image.dispatchEvent(new Event('load'))

		const firstResult = await firstPromise
		expect(firstResult.vct).toBeUndefined()

		const secondResult = await secondPromise
		expect(secondResult.vct).toBeDefined()
	})
})
