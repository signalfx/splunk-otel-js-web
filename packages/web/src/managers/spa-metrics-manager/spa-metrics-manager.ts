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

import { FetchXhrMonitor, MediaMonitor, PerformanceMonitor, ResourceState, ResourceStateEvent } from './monitors'
import { type PageLoadMetricsResult, QuietPeriodAwaiter } from './quiet-period-awaiter'

const SPA_METRICS_MANAGER_CONFIG_DEFAULTS = {
	ignoreUrls: [] as (string | RegExp)[],
	maxResourcesToWatch: 100,
	quietTime: 1000,
} as const

type DocumentLoadTiming = Pick<PerformanceNavigationTiming, 'fetchStart' | 'loadEventEnd'>

export function getDocumentLoadTime(navEntry: DocumentLoadTiming): number {
	// Calculates document load duration same as OTel
	// Firefox can report cached navigation fetchStart before time origin.
	// See https://github.com/w3c-cg/rum/issues/1.
	return navEntry.loadEventEnd - navEntry.fetchStart
}

export interface SpaMetricsManagerConfig {
	beaconEndpoint?: string
	ignoreUrls?: (string | RegExp)[]
	maxResourcesToWatch?: number
	quietTime?: number
}

export class SpaMetricsManager {
	private readonly config: Required<Omit<SpaMetricsManagerConfig, 'beaconEndpoint'>>

	private fetchXhrMonitor: FetchXhrMonitor

	private isMonitoring = false

	private loadingUrls = new Map<string, number>()

	private get loadingResourcesCount(): number {
		let count = 0
		for (const value of this.loadingUrls.values()) {
			count += value
		}
		return count
	}

	private mediaMonitor: MediaMonitor

	private performanceMonitor: PerformanceMonitor

	private quietPeriodAwaiter: QuietPeriodAwaiter | undefined

	constructor(config: SpaMetricsManagerConfig = {}) {
		const ignoreUrls: (string | RegExp)[] = [...(config.ignoreUrls ?? [])]

		if (config.beaconEndpoint) {
			try {
				const beaconOrigin = new URL(config.beaconEndpoint).origin
				ignoreUrls.push(new RegExp(`^${beaconOrigin}`))
			} catch {
				ignoreUrls.push(config.beaconEndpoint)
			}
		}

		const quietTime = config.quietTime ?? SPA_METRICS_MANAGER_CONFIG_DEFAULTS.quietTime

		this.config = {
			ignoreUrls,
			maxResourcesToWatch: config.maxResourcesToWatch ?? SPA_METRICS_MANAGER_CONFIG_DEFAULTS.maxResourcesToWatch,
			quietTime,
		}

		this.fetchXhrMonitor = new FetchXhrMonitor({
			ignoreUrls: this.config.ignoreUrls,
			onResourceStateChange: this.onResourceStateChange,
		})
		this.mediaMonitor = new MediaMonitor({
			onResourceStateChange: this.onResourceStateChange,
		})
		this.performanceMonitor = new PerformanceMonitor({
			ignoreUrls: this.config.ignoreUrls,
			onResourceStateChange: this.onResourceStateChange,
		})
	}

	start(): void {
		if (this.isMonitoring) {
			diag.warn('SpaMetricsManager: Already monitoring.')
			return
		}

		this.isMonitoring = true

		this.fetchXhrMonitor.start()
		this.mediaMonitor.start()
		this.performanceMonitor.start()

		diag.debug('SpaMetricsManager: Started monitoring.')
	}

	stop(): void {
		if (!this.isMonitoring) {
			return
		}

		this.isMonitoring = false
		this.fetchXhrMonitor.stop()
		this.mediaMonitor.stop()
		this.performanceMonitor.stop()
		this.loadingUrls.clear()

		diag.debug('SpaMetricsManager: Stopped monitoring.')
	}

	waitForPageLoad({ startTime }: { startTime: number }): Promise<PageLoadMetricsResult> {
		this.quietPeriodAwaiter?.complete({ areResourcesStillLoading: this.loadingResourcesCount > 0 })
		this.quietPeriodAwaiter = new QuietPeriodAwaiter({
			quietTime: this.config.quietTime,
			startTime,
		})

		if (this.loadingResourcesCount === 0) {
			this.quietPeriodAwaiter.startQuietTimer({ resourceLoadedTimestamp: startTime })
			diag.debug('No loading resources. Starting quiet timer.')
		}

		// startTime === 0 means this is a documentLoad pct — ensure it's at least the document load time
		if (startTime === 0) {
			return this.quietPeriodAwaiter.promise.then((result) => {
				const navEntry = performance.getEntriesByType('navigation')[0] as
					| PerformanceNavigationTiming
					| undefined
				const documentLoadTime = navEntry ? getDocumentLoadTime(navEntry) : 0
				return { ...result, pct: Math.max(result.pct, documentLoadTime) }
			})
		}

		return this.quietPeriodAwaiter.promise
	}

	private onResourceStateChange = (event: ResourceStateEvent): void => {
		if (event.state === ResourceState.DISCOVERED) {
			if (this.loadingResourcesCount >= this.config.maxResourcesToWatch) {
				diag.debug('SpaMetricsManager: Max resources limit reached, ignoring new resource', event.url)
				return
			}

			const count = this.loadingUrls.get(event.url) ?? 0
			this.loadingUrls.set(event.url, count + 1)
			diag.debug('Detected resource. Resetting quiet timer', event.url)
			this.quietPeriodAwaiter?.removeQuietTimer()
		} else {
			const count = this.loadingUrls.get(event.url) ?? 0
			if (count > 0) {
				if (count === 1) {
					this.loadingUrls.delete(event.url)
				} else {
					this.loadingUrls.set(event.url, count - 1)
				}

				if (this.loadingResourcesCount === 0) {
					diag.debug('No loading resources. Starting quiet timer.')
					this.quietPeriodAwaiter?.startQuietTimer({ resourceLoadedTimestamp: event.timestamp })
				}
			}
		}
	}
}

export { type PageLoadMetricsResult } from './quiet-period-awaiter'
