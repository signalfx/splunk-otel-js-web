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

import { type ElementVisibilityChangeEvent, ElementVisibilityObserver } from './element-visibility-observer'

const SELECTOR = '.loading-spinner'
const OTHER_SELECTOR = '[data-loading]'
const TEST_ELEMENT_CLASS = 'splunk-test-visibility-element'

const createVisibleElement = (className = 'loading-spinner'): HTMLElement => {
	const element = document.createElement('div')
	element.className = `${className} ${TEST_ELEMENT_CLASS}`
	element.style.height = '10px'
	element.style.width = '10px'
	document.body.append(element)
	return element
}

const waitForScan = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('ElementVisibilityObserver', () => {
	let observer: ElementVisibilityObserver
	let watchedConsumerIds: symbol[]

	// Tracks every consumerId watch() is called with, so afterEach can unwatch them all —
	// otherwise each test's MutationObserver leaks into later tests and inflates their scan counts.
	const watch = (
		consumerId: symbol,
		selectors: string[],
		onChange: (event: ElementVisibilityChangeEvent) => void,
	): void => {
		watchedConsumerIds.push(consumerId)
		observer.watch(consumerId, selectors, onChange)
	}

	beforeEach(() => {
		observer = new ElementVisibilityObserver()
		watchedConsumerIds = []
	})

	afterEach(() => {
		for (const consumerId of watchedConsumerIds) {
			observer.unwatch(consumerId)
		}

		document.body.querySelectorAll(`.${TEST_ELEMENT_CLASS}`).forEach((element) => {
			element.remove()
		})
	})

	it('emits visible:true for an element already visible when watch() is called', () => {
		createVisibleElement()
		const events: ElementVisibilityChangeEvent[] = []

		watch(Symbol('consumer'), [SELECTOR], (event) => events.push(event))

		expect(events).toHaveLength(1)
		expect(events[0].selector).toBe(SELECTOR)
		expect(events[0].visible).toBe(true)
	})

	it('emits visible:false when a watched element is removed', async () => {
		const element = createVisibleElement()
		const events: ElementVisibilityChangeEvent[] = []
		watch(Symbol('consumer'), [SELECTOR], (event) => events.push(event))

		element.remove()

		await vi.waitFor(() => {
			expect(events.map((event) => event.visible)).toEqual([true, false])
		})
	})

	it('gives a newly-joining consumer full current state without duplicating events to an existing consumer', () => {
		createVisibleElement()
		const firstEvents: ElementVisibilityChangeEvent[] = []
		const secondEvents: ElementVisibilityChangeEvent[] = []
		watch(Symbol('first'), [SELECTOR], (event) => firstEvents.push(event))

		watch(Symbol('second'), [SELECTOR], (event) => secondEvents.push(event))

		// Joining consumer gets full current state; the existing consumer, already caught up, gets
		// nothing extra (the scan's true delta since the last scan is empty for it).
		expect(firstEvents).toHaveLength(1)
		expect(secondEvents).toHaveLength(1)
	})

	it('shares one scan across two consumers watching the same selector once both are subscribed', async () => {
		createVisibleElement()
		watch(Symbol('first'), [SELECTOR], () => {})
		watch(Symbol('second'), [SELECTOR], () => {})

		const querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll')
		createVisibleElement()

		await waitForScan()

		// One MutationObserver-triggered scan notifies both consumers from a single querySelectorAll.
		expect(querySelectorAllSpy.mock.calls.filter((call) => call[0] === SELECTOR)).toHaveLength(1)

		querySelectorAllSpy.mockRestore()
	})

	it('gives a joining consumer accurate state even when a pending mutation scan has not run yet', async () => {
		const element = createVisibleElement()
		watch(Symbol('first'), [SELECTOR], () => {})

		// Element removed, but the debounced MutationObserver scan for it has not run yet — the
		// cached visibleElementsBySelector still says it's visible at this exact point.
		element.remove()

		const secondEvents: ElementVisibilityChangeEvent[] = []
		watch(Symbol('second'), [SELECTOR], (event) => secondEvents.push(event))

		// The joining consumer must not be told the removed element is visible, even though the
		// cache from the last completed scan still holds it.
		expect(secondEvents).toHaveLength(0)

		await waitForScan()
	})

	it('resync() gives the consumer full current-state events without changing its subscription', () => {
		createVisibleElement()
		const events: ElementVisibilityChangeEvent[] = []
		const consumerId = Symbol('consumer')
		watch(consumerId, [SELECTOR], (event) => events.push(event))

		observer.resync(consumerId, SELECTOR)

		// One event from watch(), one more from resync() — same element, reported again as current
		// state, not skipped just because it was already known.
		expect(events.map((event) => event.visible)).toEqual([true, true])
	})

	it('resync() does not notify other consumers watching the same selector', () => {
		createVisibleElement()
		const first = Symbol('first')
		const second = Symbol('second')
		const firstEvents: ElementVisibilityChangeEvent[] = []
		const secondEvents: ElementVisibilityChangeEvent[] = []
		watch(first, [SELECTOR], (event) => firstEvents.push(event))
		watch(second, [SELECTOR], (event) => secondEvents.push(event))

		observer.resync(first, SELECTOR)

		expect(firstEvents).toHaveLength(2)
		expect(secondEvents).toHaveLength(1)
	})

	it('resync() no-ops for a consumer that is not watching the given selector', () => {
		createVisibleElement()
		const events: ElementVisibilityChangeEvent[] = []
		const consumerId = Symbol('consumer')
		watch(consumerId, [SELECTOR], (event) => events.push(event))

		observer.resync(consumerId, OTHER_SELECTOR)

		expect(events).toHaveLength(1)
	})

	it('only notifies the dropping consumer when watch() omits a previously-watched selector', () => {
		createVisibleElement()
		const first = Symbol('first')
		const second = Symbol('second')
		const firstEvents: ElementVisibilityChangeEvent[] = []
		const secondEvents: ElementVisibilityChangeEvent[] = []
		watch(first, [SELECTOR], (event) => firstEvents.push(event))
		watch(second, [SELECTOR], (event) => secondEvents.push(event))

		watch(first, [], (event) => firstEvents.push(event))

		expect(firstEvents.map((event) => event.visible)).toEqual([true, false])
		expect(secondEvents.map((event) => event.visible)).toEqual([true])
	})

	it('does not emit a spurious drop+rediscover when watch() is called again with the same selector', () => {
		createVisibleElement()
		const consumerId = Symbol('consumer')
		const events: ElementVisibilityChangeEvent[] = []
		watch(consumerId, [SELECTOR], (event) => events.push(event))

		watch(consumerId, [SELECTOR], (event) => events.push(event))

		expect(events).toHaveLength(1)
	})

	it('warns once for an invalid selector regardless of how many consumers reference it', () => {
		const warnSpy = vi.spyOn(diag, 'warn')
		const invalidSelector = '['

		watch(Symbol('first'), [invalidSelector], () => {})
		watch(Symbol('second'), [invalidSelector], () => {})

		expect(warnSpy).toHaveBeenCalledTimes(1)
		warnSpy.mockRestore()
	})

	it('unwatch() emits drop events for everything the consumer watched and stops observing at zero consumers', () => {
		createVisibleElement()
		const consumerId = Symbol('consumer')
		const events: ElementVisibilityChangeEvent[] = []
		watch(consumerId, [SELECTOR], (event) => events.push(event))

		observer.unwatch(consumerId)

		expect(events.map((event) => event.visible)).toEqual([true, false])
	})

	it('tracks dynamically added elements after watch()', async () => {
		const events: ElementVisibilityChangeEvent[] = []
		watch(Symbol('consumer'), [SELECTOR], (event) => events.push(event))

		createVisibleElement()

		await vi.waitFor(() => {
			expect(events.map((event) => event.visible)).toEqual([true])
		})
	})

	it('reports independent events for two distinct selectors', () => {
		createVisibleElement('loading-spinner')
		createVisibleElement('other-spinner')
		const events: ElementVisibilityChangeEvent[] = []
		document.querySelector('.other-spinner')?.setAttribute('data-loading', '')

		watch(Symbol('consumer'), [SELECTOR, OTHER_SELECTOR], (event) => events.push(event))

		const selectors = events.map((event) => event.selector).toSorted()
		expect(selectors).toEqual([SELECTOR, OTHER_SELECTOR])
	})

	it('notifies the arrival on a new selector before the departure from the old one when an element swaps selectors in one mutation', async () => {
		const element = createVisibleElement()
		const events: ElementVisibilityChangeEvent[] = []
		watch(Symbol('consumer'), [SELECTOR, OTHER_SELECTOR], (event) => events.push(event))
		expect(events).toHaveLength(1)

		// One synchronous mutation: stops matching SELECTOR, starts matching OTHER_SELECTOR.
		element.className = TEST_ELEMENT_CLASS
		element.dataset.loading = ''

		await vi.waitFor(() => {
			expect(events).toHaveLength(3)
		})

		// The arrival on OTHER_SELECTOR must be notified before the departure from SELECTOR, even
		// though SELECTOR is iterated first — otherwise a consumer tracking per-element active
		// selectors could see the set go empty between the two events.
		expect(events[1]).toMatchObject({ selector: OTHER_SELECTOR, visible: true })
		expect(events[2]).toMatchObject({ selector: SELECTOR, visible: false })
	})

	it('does not observe DOM mutations once the last consumer unwatches', async () => {
		const element = createVisibleElement()
		const consumerId = Symbol('consumer')
		const events: ElementVisibilityChangeEvent[] = []
		watch(consumerId, [SELECTOR], (event) => events.push(event))
		observer.unwatch(consumerId)

		element.remove()
		createVisibleElement()
		await waitForScan()

		// Only the initial visible:true (from watch()) and the unwatch()-synthesized visible:false
		// for the pre-existing element — nothing from the two DOM mutations after unwatch.
		expect(events.map((event) => event.visible)).toEqual([true, false])
	})
})
