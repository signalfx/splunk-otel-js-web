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

import type { SpaMetricsMonitor } from '../../types'

import {
	PAGE_LOAD_METRICS_STATUS_COMPLETED,
	PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
	PAGE_LOAD_METRICS_STATUS_TIMEOUT,
} from './constants'

// const DEFAULT_MAX_PAGE_LOAD_WAIT_TIME = 180_000
const DEFAULT_QUIET_TIME = 1000
const INTERRUPT_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, once: true }
const INTERRUPT_LISTENER_REMOVE_OPTIONS: EventListenerOptions = { capture: true }

export type PageLoadMetricsStatus =
	| typeof PAGE_LOAD_METRICS_STATUS_COMPLETED
	| typeof PAGE_LOAD_METRICS_STATUS_INTERRUPTED
	| typeof PAGE_LOAD_METRICS_STATUS_TIMEOUT

export type LoadedResourceDetails = {
	duration: number
	monitorType: SpaMetricsMonitor
	url: string
}

export type PageLoadMetricsResult = {
	detectedResourcesCount: number
	lastLoadedResources: LoadedResourceDetails[]
	loadingResourceUrls: string[]
	loadingResourcesCount: number
	longestLoadedResource: LoadedResourceDetails | undefined
	pct: number
	quietTimerResetCount: number
	status: PageLoadMetricsStatus
}

type PageLoadMetricsResolveValue = Omit<
	PageLoadMetricsResult,
	| 'detectedResourcesCount'
	| 'lastLoadedResources'
	| 'loadingResourcesCount'
	| 'loadingResourceUrls'
	| 'longestLoadedResource'
	| 'quietTimerResetCount'
>

type QuietPeriodAwaiterConfig = {
	getDetectedResourcesCount: () => number
	getLastLoadedResources: () => LoadedResourceDetails[]
	getLoadingResourceUrls: () => string[]
	getLoadingResourcesCount: () => number
	getLongestLoadedResource: () => LoadedResourceDetails | undefined
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

	private readonly getDetectedResourcesCount: () => number

	private readonly getLastLoadedResources: () => LoadedResourceDetails[]

	private readonly getLoadingResourceUrls: () => string[]

	private readonly getLoadingResourcesCount: () => number

	private readonly getLongestLoadedResource: () => LoadedResourceDetails | undefined

	private isResolved = false

	private lastResourceTimestamp: number | undefined

	// private maxWaitTimeoutId: ReturnType<typeof setTimeout> | undefined

	private quietTime: number

	private quietTimerResetCount = 0

	private startTime: number

	private timeoutId: ReturnType<typeof setTimeout> | undefined

	constructor({
		getDetectedResourcesCount,
		getLastLoadedResources,
		getLoadingResourcesCount,
		getLoadingResourceUrls,
		getLongestLoadedResource,
		// maxPageLoadWaitTime = DEFAULT_MAX_PAGE_LOAD_WAIT_TIME,
		quietTime = DEFAULT_QUIET_TIME,
		startTime = performance.now(),
	}: QuietPeriodAwaiterConfig) {
		this.getDetectedResourcesCount = getDetectedResourcesCount
		this.getLastLoadedResources = getLastLoadedResources
		this.getLoadingResourceUrls = getLoadingResourceUrls
		this.getLoadingResourcesCount = getLoadingResourcesCount
		this.getLongestLoadedResource = getLongestLoadedResource
		this.startTime = startTime
		this.quietTime = quietTime
		this.promise = new Promise<PageLoadMetricsResult>((r) => {
			// @ts-expect-error Readonly property for resolve
			this.resolve = r
		})
		// Temporarily disabled: do not attach a PCT timeout
		// this.maxWaitTimeoutId = setTimeout(() => {
		// 	const pct = Math.max(maxPageLoadWaitTime, 0)
		// 	diag.debug('QuietPeriodAwaiter: Max page load wait time expired', { pct })
		// 	this.resolveOnce({
		// 		pct,
		// 		status: PAGE_LOAD_METRICS_STATUS_TIMEOUT,
		// 	})
		// }, maxPageLoadWaitTime)
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
			status: PAGE_LOAD_METRICS_STATUS_COMPLETED,
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
		this.quietTimerResetCount += 1
	}

	startQuietTimer({ resourceLoadedTimestamp }: { resourceLoadedTimestamp: number }): void {
		if (this.isResolved) {
			return
		}

		const quietPeriodTimestamp = Math.max(
			this.lastResourceTimestamp ?? resourceLoadedTimestamp,
			resourceLoadedTimestamp,
		)
		this.lastResourceTimestamp = quietPeriodTimestamp
		clearTimeout(this.timeoutId)

		this.timeoutId = setTimeout(() => {
			diag.debug('QuietPeriodAwaiter: Quiet period expired', this.quietTime)
			this.resolveOnce({
				pct: Math.max(quietPeriodTimestamp - this.startTime, 0),
				status: PAGE_LOAD_METRICS_STATUS_COMPLETED,
			})
		}, this.quietTime)
	}

	private readonly interruptListener = (): void => {
		this.interrupt()
	}

	private readonly resolve: (resolveValue: PageLoadMetricsResult) => void = () => {}

	private resolveOnce(resolveValue: PageLoadMetricsResolveValue): void {
		if (this.isResolved) {
			return
		}

		this.isResolved = true
		clearTimeout(this.timeoutId)
		this.timeoutId = undefined
		// clearTimeout(this.maxWaitTimeoutId)
		// this.maxWaitTimeoutId = undefined
		window.removeEventListener('pagehide', this.interruptListener, INTERRUPT_LISTENER_REMOVE_OPTIONS)
		this.resolve(this.withLoadingResourcesDetails(resolveValue))
	}

	private withLoadingResourcesDetails(resolveValue: PageLoadMetricsResolveValue): PageLoadMetricsResult {
		if (resolveValue.status === PAGE_LOAD_METRICS_STATUS_COMPLETED) {
			return {
				...resolveValue,
				detectedResourcesCount: this.getDetectedResourcesCount(),
				lastLoadedResources: this.getLastLoadedResources(),
				loadingResourcesCount: 0,
				loadingResourceUrls: [],
				longestLoadedResource: this.getLongestLoadedResource(),
				quietTimerResetCount: this.quietTimerResetCount,
			}
		}

		const loadingResourcesCount = this.getLoadingResourcesCount()

		return {
			...resolveValue,
			detectedResourcesCount: this.getDetectedResourcesCount(),
			lastLoadedResources: this.getLastLoadedResources(),
			loadingResourcesCount,
			loadingResourceUrls: this.getLoadingResourceUrls(),
			longestLoadedResource: this.getLongestLoadedResource(),
			quietTimerResetCount: this.quietTimerResetCount,
		}
	}
}
