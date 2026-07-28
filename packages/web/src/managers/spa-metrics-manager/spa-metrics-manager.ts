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

import { diag, type Span } from '@opentelemetry/api'
import { isUrlIgnored } from '@opentelemetry/core'

import type { SpaMetricsMonitor, SpaMetricsUrlOverride } from '../../types'
import type { Monitor, MonitorConfig } from './monitors/monitor'

import { truncateString } from '../../utils/text'
import {
	BROWSER_NAVIGATION_DETECTED_RESOURCE_COUNT_ATTRIBUTE,
	BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION,
	BROWSER_NAVIGATION_LAST_LOADED_RESOURCES_ATTRIBUTE,
	BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE,
	BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
	BROWSER_NAVIGATION_LONGEST_LOADED_RESOURCE_ATTRIBUTE,
	BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE,
	BROWSER_NAVIGATION_QUIET_TIMER_RESET_COUNT_ATTRIBUTE,
	BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
	PAGE_LOAD_METRICS_STATUS_TIMEOUT,
} from './constants'
import {
	FetchXhrMonitor,
	LoadingElementMonitor,
	MediaMonitor,
	PerformanceMonitor,
	ResourceState,
	ResourceStateEvent,
} from './monitors'
import {
	type LoadedResourceDetails,
	normalizeMaxPageLoadWaitTime,
	type PageLoadMetricsResult,
	QuietPeriodAwaiter,
} from './quiet-period-awaiter'

const SPA_METRICS_MANAGER_CONFIG_DEFAULTS = {
	blockingSelectors: [] as string[],
	clearLoadingResourcesOnNewPage: true,
	ignoreUrls: [] as (string | RegExp)[],
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
	blockingSelectors?: string[]
	clearLoadingResourcesOnNewPage?: boolean
	ignoreUrls?: (string | RegExp)[]
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

type PageLoadResourceTracker = {
	detectedResourcesCount: number
	lastLoadedResources: LoadedResourceDetails[]
	longestLoadedResource: LoadedResourceDetails | undefined
}

type DroppedLoadingResources = {
	elementResourceUrls: string[]
}

type WaitForPageLoadConfig = {
	operation?: string
	span?: Span
	startTime: number
}

type NavigationHistoryEntry = {
	operation: string
	pctEndTime?: number
	spanId: string
	startTime: number
}

type ResourceAdmissionDecision = {
	admitted: boolean
	consumed: boolean
	monitorType: SpaMetricsMonitor
	startTime: number
	url: string
}

export type NavigationActivity =
	| { type: 'document' }
	| {
			monitorTypes: readonly SpaMetricsMonitor[]
			resourceId?: string
			type: 'resource'
			url: string
	  }

export type NavigationPageAttributes = {
	pageSpanId: string
	pctRelevant: boolean
}

const MAX_LOADING_RESOURCE_URLS_TO_REPORT = 3
const MAX_LOADED_RESOURCES_TO_REPORT = 3
const MAX_LOADING_RESOURCE_URL_LENGTH = 100
const MAX_NAVIGATION_HISTORY_ENTRIES = 10
const MAX_RESOURCE_ADMISSION_ENTRIES = 1000
const RESOURCE_ADMISSION_START_TIME_TOLERANCE = 100

export interface SpaMetricsManagerConfig extends SpaMetricsManagerConfigValues {
	beaconEndpoint?: string
	urlOverrides?: SpaMetricsUrlOverride[]
}

export class SpaMetricsManager {
	private readonly config: ResolvedSpaMetricsManagerConfig

	private isMonitoring = false

	private loadingResources = new Map<string, LoadingResource>()

	private readonly monitors: ReturnType<typeof SpaMetricsManager.createMonitors>

	private navigationHistory: NavigationHistoryEntry[] = []

	private pageLoadResourceTracker: PageLoadResourceTracker | undefined

	private quietPeriodAwaiter: QuietPeriodAwaiter | undefined

	private resourceAdmissionDecisions = new Map<string, ResourceAdmissionDecision>()

	private readonly urlOverrides: ResolvedSpaMetricsUrlOverride[]

	private get detectedResourcesCount(): number {
		return this.pageLoadResourceTracker?.detectedResourcesCount ?? 0
	}

	private get loadingResourceUrls(): string[] {
		return Array.from(this.loadingResources.values())
			.slice(-MAX_LOADING_RESOURCE_URLS_TO_REPORT)
			.map((resource) => truncateString(resource.url, MAX_LOADING_RESOURCE_URL_LENGTH))
	}

	private get lastLoadedResources(): LoadedResourceDetails[] {
		return this.pageLoadResourceTracker?.lastLoadedResources ?? []
	}

	private get loadingResourcesCount(): number {
		return this.loadingResources.size
	}

	private get longestLoadedResource(): LoadedResourceDetails | undefined {
		return this.pageLoadResourceTracker?.longestLoadedResource
	}

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

	completeCurrentNavigationPct(span: Span, endTime = performance.now()): void {
		const spanId = span.spanContext().spanId
		for (let index = this.navigationHistory.length - 1; index >= 0; index--) {
			const navigation = this.navigationHistory[index]
			if (navigation.spanId === spanId) {
				navigation.pctEndTime = endTime
				return
			}
		}
	}

	getConfigForUrl(url: string): ResolvedSpaMetricsManagerConfig {
		return this.urlOverrides.find((override) => this.isUrlOverrideMatch(override.match, url))?.config ?? this.config
	}

	getCurrentNavigationSpanId(): string | undefined {
		return this.navigationHistory.at(-1)?.spanId
	}

	getNavigationOperation(startTime: number): string {
		return this.getNavigationAt(startTime)?.operation ?? BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION
	}

	getNavigationPageAttributes(
		startTime: number,
		activity?: NavigationActivity,
	): NavigationPageAttributes | undefined {
		// Performance entries can be delivered after a later navigation has started.
		// Resolve them against the navigation that was active at their original start time.
		const navigation = this.getNavigationAt(startTime)
		if (!navigation) {
			return undefined
		}

		const pctWindowOpen = navigation.pctEndTime === undefined || startTime <= navigation.pctEndTime
		const isCurrentNavigation = navigation.spanId === this.getCurrentNavigationSpanId()
		const pctRelevant =
			isCurrentNavigation &&
			pctWindowOpen &&
			(activity?.type === 'document' ||
				(activity?.type === 'resource' && this.evaluateResourceAdmission(activity, startTime)))

		return {
			pageSpanId: navigation.spanId,
			pctRelevant,
		}
	}

	setCurrentNavigationSpan(span: Span, startTime: number, operation: string): void {
		this.navigationHistory.push({ operation, spanId: span.spanContext().spanId, startTime })
		// Keep the lookup bounded for long-running single-page applications.
		if (this.navigationHistory.length > MAX_NAVIGATION_HISTORY_ENTRIES) {
			this.navigationHistory.shift()
		}
	}

	setPageLoadMetricAttributes(
		span: Span,
		{
			detectedResourcesCount,
			lastLoadedResources,
			loadingResourcesCount,
			loadingResourceUrls,
			longestLoadedResource,
			pct,
			quietTimerResetCount,
			status,
		}: PageLoadMetricsResult,
	): void {
		span.setAttribute(BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE, pct)
		span.setAttribute(BROWSER_NAVIGATION_STATUS_ATTRIBUTE, status)

		if (loadingResourcesCount > 0) {
			span.setAttribute(BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE, loadingResourcesCount)
			if (loadingResourceUrls.length > 0) {
				span.setAttribute(
					BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
					JSON.stringify(loadingResourceUrls),
				)
			}
		}

		span.setAttribute(BROWSER_NAVIGATION_DETECTED_RESOURCE_COUNT_ATTRIBUTE, detectedResourcesCount)
		span.setAttribute(BROWSER_NAVIGATION_QUIET_TIMER_RESET_COUNT_ATTRIBUTE, quietTimerResetCount)

		if (lastLoadedResources.length > 0) {
			span.setAttribute(BROWSER_NAVIGATION_LAST_LOADED_RESOURCES_ATTRIBUTE, JSON.stringify(lastLoadedResources))
		}

		if (longestLoadedResource) {
			span.setAttribute(
				BROWSER_NAVIGATION_LONGEST_LOADED_RESOURCE_ATTRIBUTE,
				JSON.stringify(longestLoadedResource),
			)
		}
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
		this.navigationHistory = []
		this.resourceAdmissionDecisions.clear()

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

	waitForPageLoad({ operation, span, startTime }: WaitForPageLoadConfig): Promise<PageLoadMetricsResult> {
		this.quietPeriodAwaiter?.interrupt()
		if (span) {
			this.setCurrentNavigationSpan(span, startTime, operation ?? BROWSER_NAVIGATION_DOCUMENT_LOAD_OPERATION)
		}

		const activeConfig = this.activeConfig
		const droppedResources = this.dropLoadingResourcesIgnoredByActiveConfig(activeConfig)
		this.pageLoadResourceTracker = {
			detectedResourcesCount: this.loadingResourcesCount,
			lastLoadedResources: [],
			longestLoadedResource: undefined,
		}

		this.monitors.elements.refresh(
			activeConfig.monitors.includes('elements') ? activeConfig.blockingSelectors : [],
			{ droppedResourceUrls: droppedResources.elementResourceUrls },
		)

		const quietPeriodAwaiter = new QuietPeriodAwaiter({
			getDetectedResourcesCount: () => this.detectedResourcesCount,
			getLastLoadedResources: () => this.lastLoadedResources,
			getLoadingResourcesCount: () => this.loadingResourcesCount,
			getLoadingResourceUrls: () => this.loadingResourceUrls,
			getLongestLoadedResource: () => this.longestLoadedResource,
			maxPageLoadWaitTime: activeConfig.maxPageLoadWaitTime,
			quietTime: activeConfig.quietTime,
			startTime,
		})
		this.quietPeriodAwaiter = quietPeriodAwaiter

		if (this.loadingResourcesCount === 0) {
			quietPeriodAwaiter.startQuietTimer({ resourceLoadedTimestamp: startTime })
			diag.debug('No loading resources. Starting quiet timer.')
		}

		let pageLoadMetricsPromise = quietPeriodAwaiter.promise

		// startTime === 0 means this is a documentLoad pct — ensure it's at least the document load time
		if (startTime === 0) {
			pageLoadMetricsPromise = pageLoadMetricsPromise.then((result) => {
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

		return pageLoadMetricsPromise.then(
			(result) => {
				try {
					if (span) {
						this.setPageLoadMetricAttributes(span, result)
					}

					return result
				} finally {
					if (span) {
						this.completeCurrentNavigationPct(span, startTime + result.pct)
					}
				}
			},
			(error) => {
				if (span) {
					this.completeCurrentNavigationPct(span)
				}

				throw error
			},
		)
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

	private evaluateResourceAdmission(
		activity: Extract<NavigationActivity, { type: 'resource' }>,
		startTime: number,
	): boolean {
		if (activity.resourceId) {
			const decision = this.resourceAdmissionDecisions.get(activity.resourceId)
			if (!decision) {
				return false
			}

			decision.consumed = true
			return decision.admitted
		}

		const normalizedUrl = this.normalizeResourceUrl(activity.url)
		const closestDecisionByMonitor = new Map<SpaMetricsMonitor, ResourceAdmissionDecision>()
		for (const decision of this.resourceAdmissionDecisions.values()) {
			const startTimeDifference = Math.abs(decision.startTime - startTime)
			if (
				decision.consumed ||
				!activity.monitorTypes.includes(decision.monitorType) ||
				decision.url !== normalizedUrl ||
				startTimeDifference > RESOURCE_ADMISSION_START_TIME_TOLERANCE
			) {
				continue
			}

			const closestDecision = closestDecisionByMonitor.get(decision.monitorType)
			if (!closestDecision || startTimeDifference < Math.abs(closestDecision.startTime - startTime)) {
				closestDecisionByMonitor.set(decision.monitorType, decision)
			}
		}

		const matchingDecisions = Array.from(closestDecisionByMonitor.values())
		for (const decision of matchingDecisions) {
			decision.consumed = true
		}

		return matchingDecisions.some((decision) => decision.admitted)
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

	private getNavigationAt(startTime: number): NavigationHistoryEntry | undefined {
		for (let index = this.navigationHistory.length - 1; index >= 0; index--) {
			const navigation = this.navigationHistory[index]
			if (startTime >= navigation.startTime) {
				return navigation
			}
		}

		return undefined
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

	private normalizeResourceUrl(url: string): string {
		try {
			return new URL(url, location.href).toString()
		} catch {
			return url
		}
	}

	private onResourceStateChange = (event: ResourceStateEvent): void => {
		if (event.state === ResourceState.DISCOVERED) {
			const activeConfig = this.activeConfig
			const admitted =
				activeConfig.monitors.includes(event.monitorType) &&
				!this.isIgnoredUrl(event.url, activeConfig.ignoreUrls) &&
				this.loadingResourcesCount < activeConfig.maxResourcesToWatch

			this.persistResourceAdmission(event, admitted)

			if (!admitted) {
				if (this.loadingResourcesCount >= activeConfig.maxResourcesToWatch) {
					diag.debug('SpaMetricsManager: Max resources limit reached, ignoring new resource', event.url)
				}

				return
			}

			this.loadingResources.set(event.id, {
				monitorType: event.monitorType,
				pageUrl: location.href,
				url: event.url,
			})
			if (this.pageLoadResourceTracker) {
				this.pageLoadResourceTracker.detectedResourcesCount += 1
			}

			diag.debug('Detected resource. Resetting quiet timer', event.url)
			this.quietPeriodAwaiter?.removeQuietTimer()
		} else {
			const resource = this.loadingResources.get(event.id)
			if (resource && this.loadingResources.delete(event.id)) {
				if (event.state === ResourceState.LOADED) {
					this.recordLoadedResource(resource, event.loadTime)
				}

				if (this.loadingResourcesCount === 0) {
					diag.debug('No loading resources. Starting quiet timer.')
					this.quietPeriodAwaiter?.startQuietTimer({ resourceLoadedTimestamp: event.timestamp })
				}
			}
		}
	}

	private persistResourceAdmission(
		event: ResourceStateEvent & { state: ResourceState.DISCOVERED },
		admitted: boolean,
	): void {
		const startTime = event.timestamp ?? performance.now()
		this.resourceAdmissionDecisions.set(event.id, {
			admitted,
			consumed: false,
			monitorType: event.monitorType,
			startTime,
			url: this.normalizeResourceUrl(event.url),
		})

		if (this.resourceAdmissionDecisions.size > MAX_RESOURCE_ADMISSION_ENTRIES) {
			const oldestResourceId = this.resourceAdmissionDecisions.keys().next().value
			if (typeof oldestResourceId === 'string') {
				this.resourceAdmissionDecisions.delete(oldestResourceId)
			}
		}
	}

	private recordLoadedResource(resource: LoadingResource, duration: number): void {
		if (!this.pageLoadResourceTracker) {
			return
		}

		const loadedResource = {
			duration,
			monitorType: resource.monitorType,
			url: truncateString(resource.url, MAX_LOADING_RESOURCE_URL_LENGTH),
		}

		this.pageLoadResourceTracker.lastLoadedResources = [
			...this.pageLoadResourceTracker.lastLoadedResources,
			loadedResource,
		].slice(-MAX_LOADED_RESOURCES_TO_REPORT)

		if (
			this.pageLoadResourceTracker.longestLoadedResource === undefined ||
			duration > this.pageLoadResourceTracker.longestLoadedResource.duration
		) {
			this.pageLoadResourceTracker.longestLoadedResource = loadedResource
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
			blockingSelectors: [...(config.blockingSelectors ?? defaultConfig.blockingSelectors)],
			clearLoadingResourcesOnNewPage:
				config.clearLoadingResourcesOnNewPage ?? defaultConfig.clearLoadingResourcesOnNewPage,
			ignoreUrls: this.getResolvedIgnoreUrls(
				config.ignoreUrls ?? defaultConfig.ignoreUrls,
				beaconEndpointIgnoreUrls,
			),
			maxPageLoadWaitTime: normalizeMaxPageLoadWaitTime({ maxPageLoadWaitTime, quietTime }),
			maxResourcesToWatch: config.maxResourcesToWatch ?? defaultConfig.maxResourcesToWatch,
			monitors: [...(config.monitors ?? defaultConfig.monitors)],
			quietTime,
		}
	}
}
