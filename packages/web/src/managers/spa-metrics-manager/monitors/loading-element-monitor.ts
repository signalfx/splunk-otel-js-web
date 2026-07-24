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

import type { SpaMetricsMonitor } from '../../../types'
import type { ElementVisibilityChangeEvent, ElementVisibilityObserver } from '../../../observers/element-visibility-observer'

import { Monitor, type MonitorConfig } from './monitor'

type MonitoredSelector = {
	id: string
	startTime: number
	url: string
}

type LoadingElementMonitorRefreshOptions = {
	droppedResourceUrls?: string[]
}

const LOADING_ELEMENT_URL_PREFIX = 'element:'

/**
 * Watches configured CSS selectors and tracks each selector, not each DOM element, as one loading resource.
 * Multiple visible elements can match the same selector at the same time; they are collapsed into that
 * single selector resource.
 *
 * Example: if one or more `.loading-spinner` elements are visible, this monitor emits one DISCOVERED
 * resource with `url: "element:.loading-spinner"`. It emits the matching LOADED event only when no
 * visible element matches `.loading-spinner` anymore, so removing one of several spinners does not
 * complete the resource too early.
 *
 * DOM watching itself is delegated to the shared ElementVisibilityObserver (config.elementVisibilityObserver,
 * config.consumerId) — this class only derives PCT's any-visible-per-selector aggregate from the
 * per-element events it receives.
 */
export class LoadingElementMonitor extends Monitor {
	protected readonly monitorType: SpaMetricsMonitor = 'elements'

	private readonly consumerId: symbol

	private readonly elementVisibilityObserver: ElementVisibilityObserver

	private isMonitoring = false

	private monitoredSelectors = new Map<string, MonitoredSelector>()

	private selectors: string[] = []

	private visibleElementsBySelector = new Map<string, Set<Element>>()

	constructor(config: MonitorConfig) {
		super(config)
		if (!config.elementVisibilityObserver || !config.consumerId) {
			throw new Error('LoadingElementMonitor requires elementVisibilityObserver and consumerId.')
		}

		this.elementVisibilityObserver = config.elementVisibilityObserver
		this.consumerId = config.consumerId
	}

	/**
	 * Applies the selectors for the currently active URL config and scans immediately.
	 * This is called when PCT starts so elements already visible before the MutationObserver
	 * sees any changes are still counted.
	 */
	refresh(selectors: string[], options: LoadingElementMonitorRefreshOptions = {}): void {
		const droppedSelectors = this.forgetDroppedResources(options.droppedResourceUrls)
		this.setSelectors(selectors)
		this.elementVisibilityObserver.watch(this.consumerId, this.selectors, this.handleVisibilityChange)

		// A dropped resource's selector may still be visible and still in the new selector list —
		// watch() alone won't re-scan an already-watched selector, so force it explicitly.
		for (const selector of droppedSelectors) {
			if (this.selectors.includes(selector)) {
				this.elementVisibilityObserver.resync(this.consumerId, selector)
			}
		}
	}

	start(): void {
		if (this.isMonitoring) {
			diag.warn('PageLoadingManager.LoadingElementMonitor: Already monitoring loading elements.')
			return
		}

		this.isMonitoring = true
		this.elementVisibilityObserver.watch(this.consumerId, this.selectors, this.handleVisibilityChange)

		diag.debug('PageLoadingManager.LoadingElementMonitor: Started monitoring loading elements.')
	}

	stop(): void {
		// Clear bookkeeping before unwatch() so its synthesized visible:false events no-op instead
		// of emitting LOADED for selectors being torn down, not resolved. Runs even if !isMonitoring,
		// since refresh() can establish a subscription without start() ever having run.
		this.monitoredSelectors.clear()
		this.visibleElementsBySelector.clear()
		this.elementVisibilityObserver.unwatch(this.consumerId)

		if (!this.isMonitoring) {
			return
		}

		this.isMonitoring = false
		diag.debug('PageLoadingManager.LoadingElementMonitor: Stopped monitoring.')
	}

	/**
	 * Marks a selector as no longer blocking page completion.
	 * The resource id must match the original DISCOVERED event so SpaMetricsManager can
	 * remove the exact pending resource.
	 */
	private completeSelector(selector: string): void {
		const monitoredSelector = this.monitoredSelectors.get(selector)
		if (!monitoredSelector) {
			return
		}

		this.monitoredSelectors.delete(selector)
		this.emitResourceStateChange(
			Monitor.createLoadedEvent(
				monitoredSelector.id,
				monitoredSelector.url,
				performance.now() - monitoredSelector.startTime,
			),
		)
	}

	/** Returns the selectors it dropped, so callers can decide whether any need re-syncing. */
	private forgetDroppedResources(droppedResourceUrls: string[] = []): string[] {
		if (droppedResourceUrls.length === 0) {
			return []
		}

		const droppedResourceUrlSet = new Set(droppedResourceUrls)
		const droppedSelectors: string[] = []
		for (const [selector, monitoredSelector] of this.monitoredSelectors) {
			if (droppedResourceUrlSet.has(monitoredSelector.url)) {
				this.monitoredSelectors.delete(selector)
				// Also forget our own visibility bookkeeping — otherwise a later resync() would see
				// wasBlocking already true and never re-emit DISCOVERED for a still-visible element.
				this.visibleElementsBySelector.delete(selector)
				droppedSelectors.push(selector)
			}
		}

		return droppedSelectors
	}

	/**
	 * Selector resources are reported in timeout/interruption details. Prefixing them keeps
	 * them distinguishable from network/media URLs while using the existing resource payload.
	 */
	private getLoadingElementUrl(selector: string): string {
		return `${LOADING_ELEMENT_URL_PREFIX}${selector}`
	}

	/**
	 * Derives PCT's any-visible-per-selector aggregate from the observer's per-element events:
	 * a selector transitions to blocking on its first visible element (DISCOVERED) and to
	 * not-blocking when its last visible element disappears (LOADED via completeSelector).
	 */
	private readonly handleVisibilityChange = (event: ElementVisibilityChangeEvent): void => {
		const { element, selector, visible } = event
		const elements = this.visibleElementsBySelector.get(selector) ?? new Set<Element>()
		const wasBlocking = elements.size > 0

		if (visible) {
			elements.add(element)
		} else {
			elements.delete(element)
		}

		if (elements.size === 0) {
			this.visibleElementsBySelector.delete(selector)
		} else {
			this.visibleElementsBySelector.set(selector, elements)
		}

		const isBlocking = elements.size > 0

		if (isBlocking && !wasBlocking) {
			const url = this.getLoadingElementUrl(selector)
			const discoveredEvent = Monitor.createDiscoveredEvent(url)
			this.monitoredSelectors.set(selector, {
				id: discoveredEvent.id,
				startTime: performance.now(),
				url,
			})
			this.emitResourceStateChange(discoveredEvent)
		} else if (!isBlocking && wasBlocking) {
			this.completeSelector(selector)
		}
	}

	/**
	 * Replaces the active selector list. Selectors removed by URL overrides must be completed
	 * immediately so they do not keep the new page's PCT waiting.
	 */
	private setSelectors(selectors: string[]): void {
		const nextSelectors = [...new Set(selectors)]
		const nextSelectorSet = new Set(nextSelectors)
		for (const selector of this.monitoredSelectors.keys()) {
			if (!nextSelectorSet.has(selector)) {
				this.completeSelector(selector)
				this.visibleElementsBySelector.delete(selector)
			}
		}

		this.selectors = nextSelectors
	}
}
