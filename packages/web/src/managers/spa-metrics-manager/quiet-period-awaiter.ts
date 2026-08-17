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

const DEFAULT_MAX_PAGE_LOAD_WAIT_TIME = 180_000
const DEFAULT_QUIET_TIME = 1000
const INTERRUPT_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, once: true }
const INTERRUPT_LISTENER_REMOVE_OPTIONS: EventListenerOptions = { capture: true }

export type PageLoadMetricsStatus =
	| typeof PAGE_LOAD_METRICS_STATUS_COMPLETED
	| typeof PAGE_LOAD_METRICS_STATUS_INTERRUPTED
	| typeof PAGE_LOAD_METRICS_STATUS_TIMEOUT

export type PageLoadCompletionSource = 'automatic' | 'manual'

export interface ManualPageLoadHandle {
	markComplete(): boolean
}

export type LoadedResourceDetails = {
	duration: number
	monitorType: SpaMetricsMonitor
	url: string
}

export type PageLoadMetricsResult = {
	completionSource?: PageLoadCompletionSource
	detectedResourcesCount: number
	lastLoadedResources: LoadedResourceDetails[]
	loadingResourceUrls: string[]
	loadingResourcesCount: number
	longestLoadedResource: LoadedResourceDetails | undefined
	pct: number
	quietTimerResetCount: number
	status: PageLoadMetricsStatus
}

type PageLoadMetricsResourceDetails = Omit<PageLoadMetricsResult, 'completionSource' | 'pct' | 'status'>

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
	onManualCompletionCandidate?: (timestamp: number) => void
	onManualRegistrationReopened?: () => void
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

	private lastManualCompletionTimestamp: number | undefined

	private lastResourceTimestamp: number | undefined

	private manualCompletionResourceDetails: PageLoadMetricsResourceDetails | undefined

	private manualMode = false

	private manualParticipantId = 0

	private readonly manualParticipants = new Set<number>()

	private maxWaitTimeoutId: ReturnType<typeof setTimeout> | undefined

	private readonly onManualCompletionCandidate: (timestamp: number) => void

	private readonly onManualRegistrationReopened: () => void

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
		maxPageLoadWaitTime = DEFAULT_MAX_PAGE_LOAD_WAIT_TIME,
		onManualCompletionCandidate = () => {},
		onManualRegistrationReopened = () => {},
		quietTime = DEFAULT_QUIET_TIME,
		startTime = performance.now(),
	}: QuietPeriodAwaiterConfig) {
		this.getDetectedResourcesCount = getDetectedResourcesCount
		this.getLastLoadedResources = getLastLoadedResources
		this.getLoadingResourceUrls = getLoadingResourceUrls
		this.getLoadingResourcesCount = getLoadingResourcesCount
		this.getLongestLoadedResource = getLongestLoadedResource
		this.onManualCompletionCandidate = onManualCompletionCandidate
		this.onManualRegistrationReopened = onManualRegistrationReopened
		this.startTime = startTime
		this.quietTime = quietTime
		this.promise = new Promise<PageLoadMetricsResult>((r) => {
			// @ts-expect-error Readonly property for resolve
			this.resolve = r
		})
		const elapsedTime = Math.max(performance.now() - startTime, 0)
		this.maxWaitTimeoutId = setTimeout(
			() => {
				if (
					this.manualMode &&
					this.manualParticipants.size === 0 &&
					this.lastManualCompletionTimestamp !== undefined
				) {
					this.resolveManualCompletion()
					return
				}

				const pct = Math.max(maxPageLoadWaitTime, 0)
				diag.debug('QuietPeriodAwaiter: Max page load wait time expired', { pct })
				this.resolveOnce({
					pct,
					status: PAGE_LOAD_METRICS_STATUS_TIMEOUT,
				})
			},
			Math.max(maxPageLoadWaitTime - elapsedTime, 0),
		)
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
			completionSource: 'automatic',
			pct,
			status: PAGE_LOAD_METRICS_STATUS_COMPLETED,
		})
	}

	interrupt(endTimestamp = performance.now()): void {
		if (this.isResolved) {
			return
		}

		if (this.manualMode && this.manualParticipants.size === 0 && this.lastManualCompletionTimestamp !== undefined) {
			this.resolveManualCompletion()
			return
		}

		const pct = Math.max(endTimestamp - this.startTime, 0)
		diag.debug('QuietPeriodAwaiter: Interrupted', { pct })
		this.resolveOnce({
			pct,
			status: PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
		})
	}

	removeQuietTimer(): void {
		if (this.manualMode) {
			return
		}

		if (this.timeoutId === undefined) {
			return
		}

		clearTimeout(this.timeoutId)
		this.timeoutId = undefined
		this.quietTimerResetCount += 1
	}

	startManualPageLoad(): ManualPageLoadHandle | undefined {
		if (this.isResolved) {
			return undefined
		}

		if (!this.manualMode) {
			this.manualMode = true
			this.clearQuietTimer()
		} else if (this.manualParticipants.size === 0) {
			// Reopen the registration window when another component joins before it expires.
			this.clearQuietTimer()
			this.onManualRegistrationReopened()
		}

		this.manualParticipantId += 1
		const participantId = this.manualParticipantId
		this.manualParticipants.add(participantId)
		let completed = false

		return {
			markComplete: () => {
				if (completed || this.isResolved || !this.manualParticipants.delete(participantId)) {
					return false
				}

				completed = true
				this.lastManualCompletionTimestamp = performance.now()
				this.manualCompletionResourceDetails = this.getCurrentResourceDetails()
				if (this.manualParticipants.size === 0) {
					this.onManualCompletionCandidate(this.lastManualCompletionTimestamp)
					this.startManualRegistrationTimer()
				}

				return true
			},
		}
	}

	startQuietTimer({ resourceLoadedTimestamp }: { resourceLoadedTimestamp: number }): void {
		if (this.isResolved || this.manualMode) {
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
				completionSource: 'automatic',
				pct: Math.max(quietPeriodTimestamp - this.startTime, 0),
				status: PAGE_LOAD_METRICS_STATUS_COMPLETED,
			})
		}, this.quietTime)
	}

	private clearQuietTimer(): void {
		clearTimeout(this.timeoutId)
		this.timeoutId = undefined
	}

	private getCurrentResourceDetails(): PageLoadMetricsResourceDetails {
		return {
			detectedResourcesCount: this.getDetectedResourcesCount(),
			lastLoadedResources: this.getLastLoadedResources(),
			loadingResourcesCount: this.getLoadingResourcesCount(),
			loadingResourceUrls: this.getLoadingResourceUrls(),
			longestLoadedResource: this.getLongestLoadedResource(),
			quietTimerResetCount: this.quietTimerResetCount,
		}
	}

	private readonly interruptListener = (): void => {
		this.interrupt()
	}

	private readonly resolve: (resolveValue: PageLoadMetricsResult) => void = () => {}

	private resolveManualCompletion(): void {
		if (this.lastManualCompletionTimestamp === undefined) {
			return
		}

		const pct = Math.max(this.lastManualCompletionTimestamp - this.startTime, 0)
		diag.debug('QuietPeriodAwaiter: Manual completion', { pct })
		this.resolveOnce({
			completionSource: 'manual',
			pct,
			status: PAGE_LOAD_METRICS_STATUS_COMPLETED,
		})
	}

	private resolveOnce(resolveValue: PageLoadMetricsResolveValue): void {
		if (this.isResolved) {
			return
		}

		this.isResolved = true
		this.clearQuietTimer()
		clearTimeout(this.maxWaitTimeoutId)
		this.maxWaitTimeoutId = undefined
		this.manualParticipants.clear()
		window.removeEventListener('pagehide', this.interruptListener, INTERRUPT_LISTENER_REMOVE_OPTIONS)
		this.resolve(this.withLoadingResourcesDetails(resolveValue))
	}

	private startManualRegistrationTimer(): void {
		this.clearQuietTimer()
		this.timeoutId = setTimeout(() => this.resolveManualCompletion(), this.quietTime)
	}

	private withLoadingResourcesDetails(resolveValue: PageLoadMetricsResolveValue): PageLoadMetricsResult {
		if (resolveValue.completionSource === 'manual' && this.manualCompletionResourceDetails) {
			return { ...resolveValue, ...this.manualCompletionResourceDetails }
		}

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
