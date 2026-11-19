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

/**
 * A bounded `requestIdleCallback` for browsers that do not implement it (Safari on macOS and iOS).
 *
 * The session replay module installs its own fallback on `window` when `window.requestIdleCallback` is
 * undefined. That fallback re-schedules every pending callback on each animation frame and, while the main
 * thread stays busy, never runs callbacks registered without a `timeout`. A page that calls
 * `requestIdleCallback` without a timeout can then build up an unbounded backlog of pending callbacks.
 *
 * This polyfill is installed under the same condition, before the session replay module loads, so the
 * fallback is never installed. Browsers with a native implementation are left untouched.
 */

/** Longest a callback waits when the caller passes no `timeout`, or a longer one. */
export const MAX_WAIT_MS = 1000

/** Time given to callbacks in each run of the queue while none of them is overdue. */
export const IDLE_BUDGET_MS = 8

/** Upper bound for a single run of the queue, so a backlog of overdue callbacks cannot block the page. */
export const MAX_DRAIN_MS = 50

/** Set on the installed `requestIdleCallback` so the polyfill can be recognised. */
export const POLYFILL_MARKER = '__splunkIdleCallbackPolyfill'

interface PendingCallback {
	callback: IdleRequestCallback
	handle: number
	/** The callback runs no later than this, idle or not. */
	runBy: number
	/** Deadline requested by the caller; used only to report `didTimeout`. */
	timeoutAt: number | undefined
}

export interface IdleCallbackPolyfill {
	cancelIdleCallback: (handle: number) => void
	pendingCount: () => number
	requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
}

export interface IdleCallbackTarget {
	cancelIdleCallback?: (handle: number) => void
	requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
}

export function createIdleCallbackPolyfill(): IdleCallbackPolyfill {
	// Callbacks run in the order they were requested, from a single queue with at most one timer,
	// so the cost of waiting does not grow with the number of pending callbacks.
	const queue: PendingCallback[] = []
	let nextHandle = 1
	let isDrainScheduled = false

	const scheduleDrain = () => {
		if (isDrainScheduled || queue.length === 0) {
			return
		}

		isDrainScheduled = true
		setTimeout(drain, 1)
	}

	const drain = () => {
		isDrainScheduled = false
		const drainStart = performance.now()
		const idleDeadline = drainStart + IDLE_BUDGET_MS

		while (queue.length > 0) {
			const now = performance.now()
			const isOverdue = now >= queue[0].runBy
			const isIdleBudgetSpent = now >= idleDeadline
			const isDrainTooLong = now - drainStart >= MAX_DRAIN_MS
			if (isDrainTooLong || (isIdleBudgetSpent && !isOverdue)) {
				break
			}

			const pending = queue.shift() as PendingCallback
			runCallback(pending, now, idleDeadline)
		}

		scheduleDrain()
	}

	return {
		cancelIdleCallback: (handle) => {
			const index = queue.findIndex((pending) => pending.handle === handle)
			if (index !== -1) {
				queue.splice(index, 1)
			}
		},
		pendingCount: () => queue.length,
		requestIdleCallback: (callback, options) => {
			if (typeof callback !== 'function') {
				throw new TypeError('requestIdleCallback: callback is not a function')
			}

			const now = performance.now()
			const timeout = options?.timeout
			const hasTimeout = typeof timeout === 'number' && timeout > 0
			const handle = nextHandle
			nextHandle += 1

			queue.push({
				callback,
				handle,
				runBy: now + (hasTimeout ? Math.min(timeout, MAX_WAIT_MS) : MAX_WAIT_MS),
				timeoutAt: hasTimeout ? now + timeout : undefined,
			})
			scheduleDrain()

			return handle
		},
	}
}

function runCallback(pending: PendingCallback, now: number, idleDeadline: number) {
	const deadline: IdleDeadline = {
		didTimeout: pending.timeoutAt !== undefined && now >= pending.timeoutAt,
		timeRemaining: () => Math.max(0, idleDeadline - performance.now()),
	}

	try {
		pending.callback(deadline)
	} catch (error) {
		// Report like an uncaught error in a native idle callback, without stopping the remaining callbacks.
		reportCallbackError(error)
	}
}

function reportCallbackError(error: unknown) {
	const report = (globalThis as { reportError?: (error: unknown) => void }).reportError
	if (typeof report === 'function') {
		report(error)
		return
	}

	setTimeout(() => {
		throw error
	})
}

/**
 * Installs the polyfill on `target` when it has no `requestIdleCallback`.
 * Uses the same condition as the session replay fallback, so nothing changes where that fallback would not apply.
 *
 * @returns `true` if the polyfill was installed.
 */
export function installIdleCallbackPolyfill(target: IdleCallbackTarget): boolean {
	if (target.requestIdleCallback !== undefined) {
		return false
	}

	const polyfill = createIdleCallbackPolyfill()
	const requestIdleCallback: NonNullable<IdleCallbackTarget['requestIdleCallback']> = (callback, options) =>
		polyfill.requestIdleCallback(callback, options)
	Object.defineProperty(requestIdleCallback, POLYFILL_MARKER, { value: true })

	target.requestIdleCallback = requestIdleCallback
	target.cancelIdleCallback = polyfill.cancelIdleCallback

	return true
}
