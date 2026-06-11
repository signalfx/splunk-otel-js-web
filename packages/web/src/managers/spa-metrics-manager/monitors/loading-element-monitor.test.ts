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

import { diag } from '@opentelemetry/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoadingElementMonitor } from './loading-element-monitor'
import { ResourceState, ResourceStateEvent } from './monitor'
import { expectEventStatesWithMatchingIds } from './monitor-test-utils'

const LOADING_SELECTOR = '.loading-spinner'
const TEST_ELEMENT_CLASS = 'splunk-test-loading-element'

const createVisibleLoadingElement = (): HTMLElement => {
	const element = document.createElement('div')
	element.className = `loading-spinner ${TEST_ELEMENT_CLASS}`
	element.style.height = '10px'
	element.style.width = '10px'
	document.body.append(element)
	return element
}

const waitForScan = () => new Promise((resolve) => setTimeout(resolve, 20))
const getObserver = (loadingElementMonitor: LoadingElementMonitor) =>
	(loadingElementMonitor as unknown as { observer: MutationObserver | null }).observer

describe('LoadingElementMonitor', () => {
	let events: ResourceStateEvent[]
	let monitor: LoadingElementMonitor

	beforeEach(() => {
		events = []
		monitor = new LoadingElementMonitor({
			onResourceStateChange: (event) => events.push(event),
		})
	})

	afterEach(() => {
		monitor.stop()
		document.body.querySelectorAll(`.${TEST_ELEMENT_CLASS}, .loading-spinner`).forEach((element) => {
			element.remove()
		})
	})

	it('tracks visible existing elements when refreshed', () => {
		createVisibleLoadingElement()

		monitor.refresh([LOADING_SELECTOR])

		expect(events).toHaveLength(1)
		expect(events[0].monitorType).toBe('elements')
		expect(events[0].state).toBe(ResourceState.DISCOVERED)
		expect(events[0].url).toBe(`element:${LOADING_SELECTOR}`)
	})

	it('keeps a visible selector tracked when refreshed without dropped resources', () => {
		createVisibleLoadingElement()

		monitor.refresh([LOADING_SELECTOR])
		monitor.refresh([LOADING_SELECTOR])

		expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED])
	})

	it('discovers a new resource when a visible selector was dropped by the manager', () => {
		createVisibleLoadingElement()

		monitor.refresh([LOADING_SELECTOR])
		monitor.refresh([LOADING_SELECTOR], { droppedResourceUrls: [`element:${LOADING_SELECTOR}`] })

		expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED, ResourceState.DISCOVERED])
		expect(events[1].id).not.toBe(events[0].id)
	})

	it('tracks dynamically added visible elements', async () => {
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		createVisibleLoadingElement()

		await vi.waitFor(() => {
			expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED])
		})
	})

	it('observes mutations only while monitoring with selectors', async () => {
		monitor.start()
		expect(getObserver(monitor)).toBeNull()

		monitor.refresh([LOADING_SELECTOR])
		expect(getObserver(monitor)).not.toBeNull()

		createVisibleLoadingElement()

		await vi.waitFor(() => {
			expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED])
		})

		monitor.refresh([])
		expect(getObserver(monitor)).toBeNull()
	})

	it('marks removed elements as loaded', async () => {
		const element = createVisibleLoadingElement()
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		element.remove()

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})
	})

	it('keeps one selector resource loading until all matching elements are gone', async () => {
		const firstElement = createVisibleLoadingElement()
		const secondElement = createVisibleLoadingElement()
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		firstElement.remove()
		await waitForScan()

		expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED])

		secondElement.remove()

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})
	})

	it('marks elements with display none as loaded', async () => {
		const element = createVisibleLoadingElement()
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		element.style.display = 'none'

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})
	})

	it('discovers a new resource when a selector becomes visible again after being hidden', async () => {
		const element = createVisibleLoadingElement()
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		element.style.display = 'none'

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})

		element.style.display = 'block'

		await vi.waitFor(() => {
			expect(events.map((event) => event.state)).toEqual([
				ResourceState.DISCOVERED,
				ResourceState.LOADED,
				ResourceState.DISCOVERED,
			])
		})

		element.style.display = 'none'

		await vi.waitFor(() => {
			expect(events.map((event) => event.state)).toEqual([
				ResourceState.DISCOVERED,
				ResourceState.LOADED,
				ResourceState.DISCOVERED,
				ResourceState.LOADED,
			])
		})

		expect(events[0].id).toBe(events[1].id)
		expect(events[2].id).toBe(events[3].id)
		expect(events[0].id).not.toBe(events[2].id)
	})

	it('marks elements with visibility hidden as loaded', async () => {
		const element = createVisibleLoadingElement()
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		element.style.visibility = 'hidden'

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})
	})

	it('marks hidden elements as loaded', async () => {
		const element = createVisibleLoadingElement()
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		element.hidden = true

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})
	})

	it('marks elements that stop matching after class changes as loaded', async () => {
		const element = createVisibleLoadingElement()
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()

		element.className = TEST_ELEMENT_CLASS

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})
	})

	it('tracks arbitrary attribute selector changes', async () => {
		const selector = '[aria-busy="true"]'
		const element = document.createElement('div')
		element.className = TEST_ELEMENT_CLASS
		element.style.height = '10px'
		element.style.width = '10px'
		document.body.append(element)
		monitor.refresh([selector])
		monitor.start()

		element.setAttribute('aria-busy', 'true')

		await vi.waitFor(() => {
			expect(events.map((event) => event.state)).toEqual([ResourceState.DISCOVERED])
		})

		element.setAttribute('aria-busy', 'false')

		await vi.waitFor(() => {
			expectEventStatesWithMatchingIds(events, [ResourceState.DISCOVERED, ResourceState.LOADED])
		})
	})

	it('warns once and skips invalid selectors', () => {
		const warnSpy = vi.spyOn(diag, 'warn')
		const invalidSelector = '['

		monitor.refresh([invalidSelector])
		monitor.refresh([invalidSelector])

		expect(events).toHaveLength(0)
		expect(warnSpy).toHaveBeenCalledTimes(1)
		expect(warnSpy).toHaveBeenCalledWith(
			'PageLoadingManager.LoadingElementMonitor: Invalid loading element selector.',
			expect.objectContaining({ selector: invalidSelector }),
		)
		warnSpy.mockRestore()
	})

	it('stops observing element changes after stop', async () => {
		monitor.refresh([LOADING_SELECTOR])
		monitor.start()
		monitor.stop()

		createVisibleLoadingElement()
		await waitForScan()

		expect(events).toHaveLength(0)
	})
})
