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
import { QuietPeriodAwaiter } from './quiet-period-awaiter'

const SPA_METRICS_MANAGER_CONFIG_DEFAULTS = {
	ignoreUrls: [] as (string | RegExp)[],
	maxResourcesToWatch: 100,
	maxResourceWaitingTime: 60_000,
	quietTime: 1000,
} as const

export interface SpaMetricsManagerConfig {
	beaconEndpoint?: string
	ignoreUrls?: (string | RegExp)[]
	maxResourceWaitingTime?: number
	maxResourcesToWatch?: number
	quietTime?: number
}

export class SpaMetricsManager {
	private readonly config: Required<Omit<SpaMetricsManagerConfig, 'beaconEndpoint'>>

	private fetchXhrMonitor: FetchXhrMonitor

	private isMonitoring = false

	private loadingResources = new Set<string>()

	private get loadingResourcesCount(): number {
		return this.loadingResources.size
	}

	private mediaMonitor: MediaMonitor

	private performanceMonitor: PerformanceMonitor

	private quietPeriodAwaiter = new QuietPeriodAwaiter()

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

		this.config = {
			ignoreUrls,
			maxResourcesToWatch: config.maxResourcesToWatch ?? SPA_METRICS_MANAGER_CONFIG_DEFAULTS.maxResourcesToWatch,
			maxResourceWaitingTime:
				config.maxResourceWaitingTime ?? SPA_METRICS_MANAGER_CONFIG_DEFAULTS.maxResourceWaitingTime,
			quietTime: config.quietTime ?? SPA_METRICS_MANAGER_CONFIG_DEFAULTS.quietTime,
		}

		this.fetchXhrMonitor = new FetchXhrMonitor({
			ignoreUrls: this.config.ignoreUrls,
			maxResourceWaitingTime: this.config.maxResourceWaitingTime,
			onResourceStateChange: this.onResourceStateChange,
		})
		this.mediaMonitor = new MediaMonitor({
			maxResourceWaitingTime: this.config.maxResourceWaitingTime,
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
		this.loadingResources.clear()

		diag.debug('SpaMetricsManager: Stopped monitoring.')
	}

	waitForPageLoad({ startTime }: { startTime: number }) {
		this.quietPeriodAwaiter.complete({ areResourcesStillLoading: this.loadingResourcesCount > 0 })
		this.quietPeriodAwaiter = new QuietPeriodAwaiter(this.config.quietTime, startTime)

		if (this.loadingResourcesCount === 0) {
			this.quietPeriodAwaiter.startQuietTimer({ resourceLoadedTimestamp: startTime })
			diag.debug('No loading resources. Starting quiet timer.')
		}

		return this.quietPeriodAwaiter.promise
	}

	private onResourceStateChange = (event: ResourceStateEvent): void => {
		if (event.state === ResourceState.DISCOVERED) {
			if (this.loadingResourcesCount >= this.config.maxResourcesToWatch) {
				diag.debug('SpaMetricsManager: Max resources limit reached, ignoring new resource', event.url)
				return
			}

			this.loadingResources.add(event.id)
			diag.debug('Detected resource. Resetting quiet timer', event.url)
			this.quietPeriodAwaiter.removeQuietTimer()
		} else {
			if (this.loadingResources.delete(event.id)) {
				if (this.loadingResourcesCount === 0) {
					diag.debug('No loading resources. Starting quiet timer.')
					this.quietPeriodAwaiter.startQuietTimer({ resourceLoadedTimestamp: event.timestamp })
				}
			}
		}
	}
}
