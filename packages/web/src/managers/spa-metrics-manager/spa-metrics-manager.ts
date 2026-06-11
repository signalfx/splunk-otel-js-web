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
import { isUrlIgnored } from '@opentelemetry/core'

import type { SpaMetricsMonitor, SpaMetricsUrlOverride } from '../../types'
import type { Monitor, MonitorConfig } from './monitors/monitor'

import { truncateString } from '../../utils/text'
import { PAGE_LOAD_METRICS_STATUS_TIMEOUT } from './constants'
import {
	FetchXhrMonitor,
	LoadingElementMonitor,
	MediaMonitor,
	PerformanceMonitor,
	ResourceState,
	ResourceStateEvent,
} from './monitors'
import { normalizeMaxPageLoadWaitTime, type PageLoadMetricsResult, QuietPeriodAwaiter } from './quiet-period-awaiter'

const SPA_METRICS_MANAGER_CONFIG_DEFAULTS = {
	clearLoadingResourcesOnNewPage: true,
	ignoreUrls: [] as (string | RegExp)[],
	loadingElementSelectors: [] as string[],
	maxPageLoadWaitTime: 180_000,
	maxResourcesToWatch: 100,
	monitors: ['media', 'network', 'performance'] as SpaMetricsMonitor[],
	quietTime: 1000,
} as const

type DocumentLoadTiming = Pick<PerformanceNavigationTiming, 'fetchStart' | 'loadEventEnd'>

export function getDocumentLoadTime(navEntry: DocumentLoadTiming): number {
	// Calculates document load duration same as OTel
	// Firefox can report cached navigation fetchStart before time origin.
	// See https://github.com/w3c-cg/rum/issues/1.
	return navEntry.loadEventEnd - navEntry.fetchStart
}

type SpaMetricsManagerConfigValues = {
	clearLoadingResourcesOnNewPage?: boolean
	ignoreUrls?: (string | RegExp)[]
	loadingElementSelectors?: string[]
	maxPageLoadWaitTime?: number
	maxResourcesToWatch?: number
	monitors?: SpaMetricsMonitor[]
	quietTime?: number
}

type ResolvedSpaMetricsManagerConfig = Required<SpaMetricsManagerConfigValues>

type ResolvedSpaMetricsUrlOverride = {
	config: ResolvedSpaMetricsManagerConfig
	match: string | RegExp
}

type LoadingResource = {
	monitorType: SpaMetricsMonitor
	pageUrl: string
	url: string
}

type DroppedLoadingResources = {
	elementResourceUrls: string[]
}

const MAX_LOADING_RESOURCE_URLS_TO_REPORT = 3
const MAX_LOADING_RESOURCE_URL_LENGTH = 100

export interface SpaMetricsManagerConfig extends SpaMetricsManagerConfigValues {
	beaconEndpoint?: string
	urlOverrides?: SpaMetricsUrlOverride[]
}

export class SpaMetricsManager {
	private readonly config: ResolvedSpaMetricsManagerConfig

	private isMonitoring = false

	private loadingResources = new Map<string, LoadingResource>()

	private get loadingResourceUrls(): string[] {
		return Array.from(this.loadingResources.values())
			.slice(-MAX_LOADING_RESOURCE_URLS_TO_REPORT)
			.map((resource) => truncateString(resource.url, MAX_LOADING_RESOURCE_URL_LENGTH))
	}

	private get loadingResourcesCount(): number {
		return this.loadingResources.size
	}

	private readonly monitors: ReturnType<typeof SpaMetricsManager.createMonitors>

	private quietPeriodAwaiter: QuietPeriodAwaiter | undefined

	private readonly urlOverrides: ResolvedSpaMetricsUrlOverride[]

	constructor(config: SpaMetricsManagerConfig = {}) {
		const beaconEndpointIgnoreUrls = this.getBeaconEndpointIgnoreUrls(config.beaconEndpoint)
		this.config = this.resolveConfig(config, beaconEndpointIgnoreUrls)
		this.urlOverrides = (config.urlOverrides ?? []).map(({ match, ...overrideConfig }) => ({
			config: this.resolveConfig(overrideConfig, beaconEndpointIgnoreUrls, this.config),
			match,
		}))

		const monitorConfig = {
			onResourceStateChange: this.onResourceStateChange,
		}

		this.monitors = SpaMetricsManager.createMonitors(monitorConfig)
	}

	getConfigForUrl(url: string): ResolvedSpaMetricsManagerConfig {
		return this.urlOverrides.find((override) => this.isUrlOverrideMatch(override.match, url))?.config ?? this.config
	}

	private get activeConfig(): ResolvedSpaMetricsManagerConfig {
		return this.getConfigForUrl(location.href)
	}

	start(): void {
		if (this.isMonitoring) {
			diag.warn('SpaMetricsManager: Already monitoring.')
			return
		}

		this.isMonitoring = true

		for (const monitor of Object.values(this.monitors)) {
			monitor.start()
		}

		diag.debug('SpaMetricsManager: Started monitoring.')
	}

	stop(): void {
		this.quietPeriodAwaiter?.interrupt()
		this.quietPeriodAwaiter = undefined

		if (!this.isMonitoring) {
			return
		}

		this.isMonitoring = false
		for (const monitor of Object.values(this.monitors)) {
			monitor.stop()
		}
		this.loadingResources.clear()

		diag.debug('SpaMetricsManager: Stopped monitoring.')
	}

	waitForPageLoad({ startTime }: { startTime: number }): Promise<PageLoadMetricsResult> {
		this.quietPeriodAwaiter?.interrupt()
		const activeConfig = this.activeConfig
		const droppedResources = this.dropLoadingResourcesIgnoredByActiveConfig(activeConfig)
		this.monitors.elements.refresh(
			activeConfig.monitors.includes('elements') ? activeConfig.loadingElementSelectors : [],
			{ droppedResourceUrls: droppedResources.elementResourceUrls },
		)

		const quietPeriodAwaiter = new QuietPeriodAwaiter({
			getLoadingResourcesCount: () => this.loadingResourcesCount,
			getLoadingResourceUrls: () => this.loadingResourceUrls,
			maxPageLoadWaitTime: activeConfig.maxPageLoadWaitTime,
			quietTime: activeConfig.quietTime,
			startTime,
		})
		this.quietPeriodAwaiter = quietPeriodAwaiter

		if (this.loadingResourcesCount === 0) {
			quietPeriodAwaiter.startQuietTimer({ resourceLoadedTimestamp: startTime })
			diag.debug('No loading resources. Starting quiet timer.')
		}

		// startTime === 0 means this is a documentLoad pct — ensure it's at least the document load time
		if (startTime === 0) {
			return quietPeriodAwaiter.promise.then((result) => {
				// Timeout results must stay capped at maxPageLoadWaitTime, even if document load took longer.
				if (result.status === PAGE_LOAD_METRICS_STATUS_TIMEOUT) {
					return result
				}

				const navEntry = performance.getEntriesByType('navigation')[0] as
					| PerformanceNavigationTiming
					| undefined
				const documentLoadTime = navEntry ? getDocumentLoadTime(navEntry) : 0
				return { ...result, pct: Math.max(result.pct, documentLoadTime) }
			})
		}

		return quietPeriodAwaiter.promise
	}

	private static createMonitors(monitorConfig: MonitorConfig) {
		return {
			elements: new LoadingElementMonitor(monitorConfig),
			media: new MediaMonitor(monitorConfig),
			network: new FetchXhrMonitor(monitorConfig),
			performance: new PerformanceMonitor(monitorConfig),
		} as const satisfies Record<SpaMetricsMonitor, Monitor>
	}

	private dropLoadingResourcesIgnoredByActiveConfig(
		activeConfig: ResolvedSpaMetricsManagerConfig,
	): DroppedLoadingResources {
		const droppedResources: DroppedLoadingResources = { elementResourceUrls: [] }
		const pageUrl = location.href
		for (const [resourceId, resource] of this.loadingResources) {
			if (
				(activeConfig.clearLoadingResourcesOnNewPage && resource.pageUrl !== pageUrl) ||
				!activeConfig.monitors.includes(resource.monitorType) ||
				this.isIgnoredUrl(resource.url, activeConfig.ignoreUrls)
			) {
				this.loadingResources.delete(resourceId)
				if (resource.monitorType === 'elements') {
					droppedResources.elementResourceUrls.push(resource.url)
				}
			}
		}

		return droppedResources
	}

	private getBeaconEndpointIgnoreUrls(beaconEndpoint: string | undefined): (string | RegExp)[] {
		if (!beaconEndpoint) {
			return []
		}

		try {
			const beaconOrigin = new URL(beaconEndpoint).origin
			return [new RegExp(`^${beaconOrigin}`)]
		} catch {
			return [beaconEndpoint]
		}
	}

	private getResolvedIgnoreUrls(
		ignoreUrls: (string | RegExp)[],
		beaconEndpointIgnoreUrls: (string | RegExp)[],
	): (string | RegExp)[] {
		return [...new Set([...ignoreUrls, ...beaconEndpointIgnoreUrls])]
	}

	private isIgnoredUrl(url: string, ignoreUrls: (string | RegExp)[]): boolean {
		return url.toLowerCase().startsWith('data:') || isUrlIgnored(url, ignoreUrls)
	}

	private isUrlOverrideMatch(match: string | RegExp, url: string): boolean {
		if (typeof match === 'string') {
			return url.includes(match)
		}

		// Regexes with global/sticky flags keep state between test() calls:
		// const regex = /checkout/g
		// regex.test('/checkout') // true
		// regex.test('/checkout') // false without resetting lastIndex
		match.lastIndex = 0
		return match.test(url)
	}

	private onResourceStateChange = (event: ResourceStateEvent): void => {
		if (event.state === ResourceState.DISCOVERED) {
			const activeConfig = this.activeConfig

			if (!activeConfig.monitors.includes(event.monitorType)) {
				return
			}

			if (this.isIgnoredUrl(event.url, activeConfig.ignoreUrls)) {
				return
			}

			if (this.loadingResourcesCount >= activeConfig.maxResourcesToWatch) {
				diag.debug('SpaMetricsManager: Max resources limit reached, ignoring new resource', event.url)
				return
			}

			this.loadingResources.set(event.id, {
				monitorType: event.monitorType,
				pageUrl: location.href,
				url: event.url,
			})
			diag.debug('Detected resource. Resetting quiet timer', event.url)
			this.quietPeriodAwaiter?.removeQuietTimer()
		} else {
			if (this.loadingResources.delete(event.id)) {
				if (this.loadingResourcesCount === 0) {
					diag.debug('No loading resources. Starting quiet timer.')
					this.quietPeriodAwaiter?.startQuietTimer({ resourceLoadedTimestamp: event.timestamp })
				}
			}
		}
	}

	private resolveConfig(
		config: SpaMetricsManagerConfigValues,
		beaconEndpointIgnoreUrls: (string | RegExp)[],
		defaultConfig: ResolvedSpaMetricsManagerConfig = SPA_METRICS_MANAGER_CONFIG_DEFAULTS,
	): ResolvedSpaMetricsManagerConfig {
		const quietTime = config.quietTime ?? defaultConfig.quietTime
		const maxPageLoadWaitTime = config.maxPageLoadWaitTime ?? defaultConfig.maxPageLoadWaitTime

		return {
			clearLoadingResourcesOnNewPage:
				config.clearLoadingResourcesOnNewPage ?? defaultConfig.clearLoadingResourcesOnNewPage,
			ignoreUrls: this.getResolvedIgnoreUrls(
				config.ignoreUrls ?? defaultConfig.ignoreUrls,
				beaconEndpointIgnoreUrls,
			),
			loadingElementSelectors: [...(config.loadingElementSelectors ?? defaultConfig.loadingElementSelectors)],
			maxPageLoadWaitTime: normalizeMaxPageLoadWaitTime({ maxPageLoadWaitTime, quietTime }),
			maxResourcesToWatch: config.maxResourcesToWatch ?? defaultConfig.maxResourcesToWatch,
			monitors: [...(config.monitors ?? defaultConfig.monitors)],
			quietTime,
		}
	}
}
