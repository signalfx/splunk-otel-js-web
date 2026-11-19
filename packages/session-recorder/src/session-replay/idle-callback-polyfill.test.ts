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
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	createIdleCallbackPolyfill,
	IDLE_BUDGET_MS,
	type IdleCallbackTarget,
	installIdleCallbackPolyfill,
	MAX_WAIT_MS,
	POLYFILL_MARKER,
} from './idle-callback-polyfill'

const blockMainThread = (ms: number) => {
	const end = performance.now() + ms
	while (performance.now() < end) {
		// Busy-wait to simulate a page that never goes idle.
	}
}

const waitUntil = async (condition: () => boolean, timeoutMs: number) => {
	const end = performance.now() + timeoutMs
	while (!condition()) {
		if (performance.now() > end) {
			throw new Error(`Condition not met within ${timeoutMs} ms`)
		}

		await new Promise((resolve) => setTimeout(resolve, 5))
	}
}

describe('installIdleCallbackPolyfill', () => {
	it('does not replace an existing requestIdleCallback', () => {
		const existing = vi.fn()
		const target: IdleCallbackTarget = { requestIdleCallback: existing }

		expect(installIdleCallbackPolyfill(target)).toBe(false)
		expect(target.requestIdleCallback).toBe(existing)
		expect(target.cancelIdleCallback).toBeUndefined()
	})

	it('only installs when requestIdleCallback is undefined, like the session replay fallback', () => {
		const target = { requestIdleCallback: null } as unknown as IdleCallbackTarget

		expect(installIdleCallbackPolyfill(target)).toBe(false)
		expect(target.requestIdleCallback).toBeNull()
	})

	it('installs requestIdleCallback and cancelIdleCallback when missing', async () => {
		const target: IdleCallbackTarget = {}

		expect(installIdleCallbackPolyfill(target)).toBe(true)
		expect(typeof target.cancelIdleCallback).toBe('function')
		expect((target.requestIdleCallback as unknown as Record<string, unknown>)[POLYFILL_MARKER]).toBe(true)

		const callback = vi.fn()
		target.requestIdleCallback?.(callback)
		await waitUntil(() => callback.mock.calls.length === 1, 1000)
	})

	it('has no side effects on import: a native implementation stays in place', () => {
		if (typeof window.requestIdleCallback !== 'function') {
			return
		}

		expect(Function.prototype.toString.call(window.requestIdleCallback)).toContain('[native code]')
	})
})

describe('createIdleCallbackPolyfill', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('runs callbacks registered without a timeout while the main thread stays busy', async () => {
		const polyfill = createIdleCallbackPolyfill()
		const count = 500
		let ran = 0
		// Keep the main thread busy 45 ms out of every 50 ms, as on a slow page.
		const busyInterval = setInterval(() => blockMainThread(45), 50)
		blockMainThread(45)
		for (let i = 0; i < count; i++) {
			polyfill.requestIdleCallback(() => {
				blockMainThread(0.1)
				ran += 1
			})
		}

		try {
			await waitUntil(() => ran === count, MAX_WAIT_MS * 3)
		} finally {
			clearInterval(busyInterval)
		}

		expect(polyfill.pendingCount()).toBe(0)
	})

	it('runs callbacks in the order they were requested', async () => {
		const polyfill = createIdleCallbackPolyfill()
		const order: number[] = []
		for (let i = 0; i < 5; i++) {
			polyfill.requestIdleCallback(() => order.push(i))
		}

		await waitUntil(() => order.length === 5, 1000)
		expect(order).toEqual([0, 1, 2, 3, 4])
	})

	it('reports didTimeout only when the caller timeout has elapsed', async () => {
		const polyfill = createIdleCallbackPolyfill()
		const deadlines: Record<string, IdleDeadline> = {}

		polyfill.requestIdleCallback((deadline) => (deadlines.withoutTimeout = deadline))
		polyfill.requestIdleCallback((deadline) => (deadlines.withElapsedTimeout = deadline), { timeout: 10 })
		blockMainThread(30)

		await waitUntil(() => Object.keys(deadlines).length === 2, 1000)
		expect(deadlines.withoutTimeout.didTimeout).toBe(false)
		expect(deadlines.withElapsedTimeout.didTimeout).toBe(true)
	})

	it('gives each callback a timeRemaining within the idle budget', async () => {
		const polyfill = createIdleCallbackPolyfill()
		let remaining: number | undefined
		polyfill.requestIdleCallback((deadline) => (remaining = deadline.timeRemaining()))

		await waitUntil(() => remaining !== undefined, 1000)
		expect(remaining).toBeGreaterThanOrEqual(0)
		expect(remaining).toBeLessThanOrEqual(IDLE_BUDGET_MS)
	})

	it('yields to other tasks instead of running a large overdue backlog in one go', async () => {
		const polyfill = createIdleCallbackPolyfill()
		const count = 20
		let ran = 0
		let ranWhenOtherTaskRan: number | undefined
		for (let i = 0; i < count; i++) {
			polyfill.requestIdleCallback(
				() => {
					blockMainThread(10)
					ran += 1
				},
				{ timeout: 1 },
			)
		}

		blockMainThread(5) // every callback is now overdue
		setTimeout(() => (ranWhenOtherTaskRan = ran), 0)

		await waitUntil(() => ran === count, 2000)
		expect(ranWhenOtherTaskRan).toBeDefined()
		expect(ranWhenOtherTaskRan).toBeLessThan(count)
	})

	it('cancels a pending callback', async () => {
		const polyfill = createIdleCallbackPolyfill()
		const cancelled = vi.fn()
		const kept = vi.fn()

		const handle = polyfill.requestIdleCallback(cancelled)
		polyfill.requestIdleCallback(kept)
		polyfill.cancelIdleCallback(handle)
		polyfill.cancelIdleCallback(9999) // unknown handles are ignored

		await waitUntil(() => kept.mock.calls.length === 1, 1000)
		expect(cancelled).not.toHaveBeenCalled()
		expect(polyfill.pendingCount()).toBe(0)
	})

	it('returns a distinct handle for every request', () => {
		const polyfill = createIdleCallbackPolyfill()
		const first = polyfill.requestIdleCallback(() => {})
		const second = polyfill.requestIdleCallback(() => {})

		expect(second).not.toBe(first)
	})

	it('throws a TypeError when the callback is not a function', () => {
		const polyfill = createIdleCallbackPolyfill()

		expect(() => polyfill.requestIdleCallback(undefined as unknown as IdleRequestCallback)).toThrow(TypeError)
		expect(polyfill.pendingCount()).toBe(0)
	})

	it('uses a single timer however many callbacks are pending', () => {
		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
		const polyfill = createIdleCallbackPolyfill()
		for (let i = 0; i < 10_000; i++) {
			polyfill.requestIdleCallback(() => {})
		}

		expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
	})

	it('reports a throwing callback and keeps running the others', async () => {
		const reportError = vi.fn()
		vi.stubGlobal('reportError', reportError)
		const polyfill = createIdleCallbackPolyfill()
		const error = new Error('callback failed')
		const next = vi.fn()

		polyfill.requestIdleCallback(() => {
			throw error
		})
		polyfill.requestIdleCallback(next)

		await waitUntil(() => next.mock.calls.length === 1, 1000)
		expect(reportError).toHaveBeenCalledWith(error)
	})
})
