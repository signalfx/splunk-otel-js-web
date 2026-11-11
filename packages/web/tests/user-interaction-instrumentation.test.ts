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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UserInteractionInstrumentation } from '../src/upstream/user-interaction/instrumentation'
import { UserInteractionInstrumentationConfig } from '../src/upstream/user-interaction/types'

// 'keypress' is not in eventNames, so these tests exercise the listener bookkeeping
// without creating spans - which is also how the leak this guards against was found.
const UNINSTRUMENTED_EVENT = 'keypress'

describe('UserInteractionInstrumentation listener bookkeeping', () => {
	let instrumentation: UserInteractionInstrumentation<UserInteractionInstrumentationConfig>
	let elements: HTMLElement[]

	const createElement = () => {
		const element = document.createElement('div')
		document.body.append(element)
		elements.push(element)
		return element
	}

	const press = (element: HTMLElement) => element.dispatchEvent(new Event(UNINSTRUMENTED_EVENT))

	beforeEach(() => {
		elements = []
		instrumentation = new UserInteractionInstrumentation({}, {})
		instrumentation.enable()
	})

	afterEach(() => {
		instrumentation.disable()
		elements.forEach((element) => element.remove())
	})

	it('patches a shared listener on every element it is added to', () => {
		const listener = vi.fn()
		const first = createElement()
		const second = createElement()

		first.addEventListener(UNINSTRUMENTED_EVENT, listener)
		second.addEventListener(UNINSTRUMENTED_EVENT, listener)
		press(first)
		press(second)

		expect(listener).toHaveBeenCalledTimes(2)
	})

	it('only unpatches the element the listener was removed from', () => {
		const listener = vi.fn()
		const kept = createElement()
		const removed = createElement()

		kept.addEventListener(UNINSTRUMENTED_EVENT, listener)
		removed.addEventListener(UNINSTRUMENTED_EVENT, listener)
		removed.removeEventListener(UNINSTRUMENTED_EVENT, listener)
		press(kept)
		press(removed)

		expect(listener).toHaveBeenCalledTimes(1)
	})

	it('patches a listener again after it was removed from every element', () => {
		const listener = vi.fn()
		const element = createElement()

		element.addEventListener(UNINSTRUMENTED_EVENT, listener)
		element.removeEventListener(UNINSTRUMENTED_EVENT, listener)
		element.addEventListener(UNINSTRUMENTED_EVENT, listener)
		press(element)

		expect(listener).toHaveBeenCalledTimes(1)
	})

	it('registers the same element, type and listener only once', () => {
		const listener = vi.fn()
		const element = createElement()

		element.addEventListener(UNINSTRUMENTED_EVENT, listener)
		element.addEventListener(UNINSTRUMENTED_EVENT, listener)
		press(element)

		expect(listener).toHaveBeenCalledTimes(1)
	})

	it('removes a "once" listener from its bookkeeping after it fires', () => {
		const listener = vi.fn()
		const element = createElement()

		element.addEventListener(UNINSTRUMENTED_EVENT, listener, { once: true })
		press(element)
		element.addEventListener(UNINSTRUMENTED_EVENT, listener)
		press(element)

		expect(listener).toHaveBeenCalledTimes(2)
	})

	it('holds event targets weakly', () => {
		const listener = vi.fn()
		const element = createElement()

		element.addEventListener(UNINSTRUMENTED_EVENT, listener)

		// Asserted on the private state because the alternative - proving an element is collected -
		// needs a forced garbage collection that browsers do not expose.
		const type2element = (instrumentation as any)._wrappedListeners.get(listener)
		expect(type2element.get(UNINSTRUMENTED_EVENT)).toBeInstanceOf(WeakMap)
	})

	it('keeps working when the method is detached from its element', () => {
		const element = createElement()
		const detachedAdd = element.addEventListener
		const detachedRemove = element.removeEventListener
		const listener = vi.fn()

		// Called this way the receiver is undefined, which the browser resolves to window rather
		// than rejecting. That receiver cannot key a WeakMap, so it must not be used as one.
		detachedAdd(UNINSTRUMENTED_EVENT, listener)
		window.dispatchEvent(new Event(UNINSTRUMENTED_EVENT))
		detachedRemove(UNINSTRUMENTED_EVENT, listener)
		window.dispatchEvent(new Event(UNINSTRUMENTED_EVENT))

		expect(listener).toHaveBeenCalledTimes(1)
	})
})
