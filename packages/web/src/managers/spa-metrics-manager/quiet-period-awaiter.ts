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

import { PAGE_LOAD_METRICS_STATUS_INTERRUPTED, PAGE_LOAD_METRICS_STATUS_TIMEOUT } from './constants'

const DEFAULT_MAX_PAGE_LOAD_WAIT_TIME = 180_000
const DEFAULT_QUIET_TIME = 1000
const INTERRUPT_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, once: true }
const INTERRUPT_LISTENER_REMOVE_OPTIONS: EventListenerOptions = { capture: true }

export type PageLoadMetricsStatus =
	| typeof PAGE_LOAD_METRICS_STATUS_INTERRUPTED
	| typeof PAGE_LOAD_METRICS_STATUS_TIMEOUT

export type PageLoadMetricsResult = {
	pct: number
	status?: PageLoadMetricsStatus
}

type QuietPeriodAwaiterConfig = {
	maxPageLoadWaitTime?: number
	quietTime?: number
	startTime?: number
}

type MaxPageLoadWaitTimeConfig = Required<Pick<QuietPeriodAwaiterConfig, 'maxPageLoadWaitTime' | 'quietTime'>>

export function normalizeMaxPageLoadWaitTime({ maxPageLoadWaitTime, quietTime }: MaxPageLoadWaitTimeConfig): number {
	if (maxPageLoadWaitTime >= quietTime) {
		return maxPageLoadWaitTime
	}

	diag.warn('spa.maxPageLoadWaitTime cannot be lower than quietTime. Using quietTime as maxPageLoadWaitTime.', {
		maxPageLoadWaitTime,
		quietTime,
	})

	return quietTime
}

export class QuietPeriodAwaiter {
	readonly promise: Promise<PageLoadMetricsResult>

	private isResolved = false

	private lastResourceTimestamp: number | undefined

	private maxPageLoadWaitTime: number

	private maxWaitTimeoutId: ReturnType<typeof setTimeout> | undefined

	private quietTime: number

	private startTime: number

	private timeoutId: ReturnType<typeof setTimeout> | undefined

	constructor({
		maxPageLoadWaitTime = DEFAULT_MAX_PAGE_LOAD_WAIT_TIME,
		quietTime = DEFAULT_QUIET_TIME,
		startTime = performance.now(),
	}: QuietPeriodAwaiterConfig = {}) {
		this.startTime = startTime
		this.quietTime = quietTime
		this.maxPageLoadWaitTime = maxPageLoadWaitTime
		this.promise = new Promise<PageLoadMetricsResult>((r) => {
			// @ts-expect-error Readonly property for resolve
			this.resolve = r
		})
		this.maxWaitTimeoutId = setTimeout(() => {
			const pct = Math.max(this.maxPageLoadWaitTime, 0)
			diag.debug('QuietPeriodAwaiter: Max page load wait time expired', { pct })
			this.resolveOnce({
				pct,
				status: PAGE_LOAD_METRICS_STATUS_TIMEOUT,
			})
		}, maxPageLoadWaitTime)
		window.addEventListener('pagehide', this.interruptListener, INTERRUPT_LISTENER_OPTIONS)
	}

	complete({ areResourcesStillLoading }: { areResourcesStillLoading: boolean }): void {
		if (this.isResolved) {
			return
		}

		let endTimestamp = performance.now()
		if (!areResourcesStillLoading && this.lastResourceTimestamp) {
			diag.debug('No resources loading. Using last resource timestamp.')
			endTimestamp = this.lastResourceTimestamp
		}

		const pct = endTimestamp - this.startTime
		diag.debug('QuietPeriodAwaiter: Complete', { pct })
		this.resolveOnce({
			pct,
		})
	}

	interrupt(): void {
		if (this.isResolved) {
			return
		}

		const endTimestamp = performance.now()
		const pct = Math.max(endTimestamp - this.startTime, 0)
		diag.debug('QuietPeriodAwaiter: Interrupted', { pct })
		this.resolveOnce({
			pct,
			status: PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
		})
	}

	removeQuietTimer(): void {
		if (this.timeoutId === undefined) {
			return
		}

		clearTimeout(this.timeoutId)
		this.timeoutId = undefined
	}

	startQuietTimer({ resourceLoadedTimestamp }: { resourceLoadedTimestamp: number }): void {
		if (this.isResolved) {
			return
		}

		this.lastResourceTimestamp = resourceLoadedTimestamp
		clearTimeout(this.timeoutId)

		this.timeoutId = setTimeout(() => {
			diag.debug('QuietPeriodAwaiter: Quiet period expired', this.quietTime)
			this.resolveOnce({
				pct: Math.max(resourceLoadedTimestamp - this.startTime, 0),
			})
		}, this.quietTime)
	}

	private readonly interruptListener = (): void => {
		this.interrupt()
	}

	private readonly resolve: (resolveValue: PageLoadMetricsResult) => void = () => {}

	private resolveOnce(resolveValue: PageLoadMetricsResult): void {
		if (this.isResolved) {
			return
		}

		this.isResolved = true
		clearTimeout(this.timeoutId)
		clearTimeout(this.maxWaitTimeoutId)
		this.timeoutId = undefined
		this.maxWaitTimeoutId = undefined
		window.removeEventListener('pagehide', this.interruptListener, INTERRUPT_LISTENER_REMOVE_OPTIONS)
		this.resolve(resolveValue)
	}
}
