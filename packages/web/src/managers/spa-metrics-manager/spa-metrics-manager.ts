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

import { FetchXhrMonitor, MediaMonitor, PerformanceMonitor } from './monitors'
import { PageLoadTimeTracker } from './page-load-time-tracker'
import { VisualCompleteTracker } from './visual-complete-tracker'

const DEFAULT_QUIET_MEDIA_TIME = 3000
const DEFAULT_QUIET_TIME = 5000

const SPA_METRICS_MANAGER_CONFIG_DEFAULTS = {
	ignoreUrls: [] as (string | RegExp)[],
	maxResourcesToWatch: 100,
	quietMediaTime: DEFAULT_QUIET_MEDIA_TIME,
	quietTime: DEFAULT_QUIET_TIME,
} as const

export interface SpaMetricsManagerConfig {
	beaconEndpoint?: string
	ignoreUrls?: (string | RegExp)[]
	maxResourcesToWatch?: number
	quietMediaTime?: number
	quietTime?: number
}

export class SpaMetricsManager {
	private readonly config: Required<Omit<SpaMetricsManagerConfig, 'beaconEndpoint'>>

	private readonly fetchXhrMonitor: FetchXhrMonitor

	private isMonitoring = false

	private readonly mediaMonitor: MediaMonitor

	private readonly pageLoadTimeTracker: PageLoadTimeTracker

	private readonly performanceMonitor: PerformanceMonitor

	private readonly visualCompleteTracker: VisualCompleteTracker

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
			quietMediaTime: config.quietMediaTime ?? SPA_METRICS_MANAGER_CONFIG_DEFAULTS.quietMediaTime,
			quietTime: config.quietTime ?? SPA_METRICS_MANAGER_CONFIG_DEFAULTS.quietTime,
		}

		this.pageLoadTimeTracker = new PageLoadTimeTracker({
			maxResourcesToWatch: this.config.maxResourcesToWatch,
			quietTime: this.config.quietTime,
		})
		this.fetchXhrMonitor = new FetchXhrMonitor({
			ignoreUrls: this.config.ignoreUrls,
			onResourceStateChange: this.pageLoadTimeTracker.onResourceStateChange,
		})
		this.mediaMonitor = new MediaMonitor({
			onResourceStateChange: this.pageLoadTimeTracker.onResourceStateChange,
		})
		this.visualCompleteTracker = new VisualCompleteTracker({
			mediaMonitor: this.mediaMonitor,
			quietMediaTime: this.config.quietMediaTime,
		})
		this.performanceMonitor = new PerformanceMonitor({
			ignoreUrls: this.config.ignoreUrls,
			onResourceStateChange: this.pageLoadTimeTracker.onResourceStateChange,
		})
	}

	start(): void {
		if (this.isMonitoring) {
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
		this.pageLoadTimeTracker.stop()
		this.visualCompleteTracker.stop()

		diag.debug('SpaMetricsManager: Stopped monitoring.')
	}

	waitForPageLoad({ startTime }: { startTime: number }) {
		const pageLoadTimePromise = this.pageLoadTimeTracker.start({ startTime })
		const visualCompletePromise = this.visualCompleteTracker.start({ startTime })

		return Promise.all([pageLoadTimePromise, visualCompletePromise]).then(
			([{ pct, timestampOfLastLoadedResource }, { vct }]) => ({
				pct,
				timestampOfLastLoadedResource,
				...(vct === undefined ? {} : { vct }),
			}),
		)
	}
}
