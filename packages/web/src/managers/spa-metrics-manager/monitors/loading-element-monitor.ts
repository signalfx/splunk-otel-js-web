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

import { isElement, type SpaMetricsMonitor } from '../../../types'
import { Monitor } from './monitor'

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
 */
export class LoadingElementMonitor extends Monitor {
	protected readonly monitorType: SpaMetricsMonitor = 'elements'

	private isMonitoring = false

	private monitoredSelectors = new Map<string, MonitoredSelector>()

	private observer: MutationObserver | null = null

	private scanTimeoutId: ReturnType<typeof setTimeout> | undefined

	private selectors: string[] = []

	private warnedInvalidSelectors = new Set<string>()

	/**
	 * Applies the selectors for the currently active URL config and scans immediately.
	 * This is called when PCT starts so elements already visible before the MutationObserver
	 * sees any changes are still counted.
	 */
	refresh(selectors: string[], options: LoadingElementMonitorRefreshOptions = {}): void {
		this.clearScheduledScan()
		this.forgetDroppedResources(options.droppedResourceUrls)
		this.setSelectors(selectors)
		this.syncMutationObserver()
		this.scanSelectors()
	}

	start(): void {
		if (this.isMonitoring) {
			diag.warn('PageLoadingManager.LoadingElementMonitor: Already monitoring loading elements.')
			return
		}

		this.isMonitoring = true
		this.syncMutationObserver()
		this.scanSelectors()

		diag.debug('PageLoadingManager.LoadingElementMonitor: Started monitoring loading elements.')
	}

	stop(): void {
		if (!this.isMonitoring) {
			return
		}

		this.observer?.disconnect()
		this.observer = null
		this.clearScheduledScan()
		// The manager interrupts/clears pending PCT resources on stop, so there is no need
		// to emit LOADED events for selectors that were still visible.
		this.monitoredSelectors.clear()
		this.isMonitoring = false

		diag.debug('PageLoadingManager.LoadingElementMonitor: Stopped monitoring.')
	}

	private clearScheduledScan(): void {
		if (this.scanTimeoutId === undefined) {
			return
		}

		clearTimeout(this.scanTimeoutId)
		this.scanTimeoutId = undefined
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

	private forgetDroppedResources(droppedResourceUrls: string[] = []): void {
		if (droppedResourceUrls.length === 0) {
			return
		}

		const droppedResourceUrlSet = new Set(droppedResourceUrls)
		for (const [selector, monitoredSelector] of this.monitoredSelectors) {
			if (droppedResourceUrlSet.has(monitoredSelector.url)) {
				this.monitoredSelectors.delete(selector)
			}
		}
	}

	/**
	 * Selector resources are reported in timeout/interruption details. Prefixing them keeps
	 * them distinguishable from network/media URLs while using the existing resource payload.
	 */
	private getLoadingElementUrl(selector: string): string {
		return `${LOADING_ELEMENT_URL_PREFIX}${selector}`
	}

	/**
	 * A selector blocks PCT if at least one matching element is currently visible.
	 * Invalid selectors are ignored after a single warning so one bad selector does not
	 * disable the whole monitor.
	 */
	private hasVisibleElement(selector: string): boolean {
		let elements: NodeListOf<Element>
		try {
			elements = document.querySelectorAll(selector)
		} catch (error) {
			if (!this.warnedInvalidSelectors.has(selector)) {
				this.warnedInvalidSelectors.add(selector)
				diag.warn('PageLoadingManager.LoadingElementMonitor: Invalid loading element selector.', {
					error,
					selector,
				})
			}

			return false
		}

		return Array.from(elements).some((element) => this.isElementVisible(element))
	}

	/**
	 * Visibility is intentionally based on rendered layout, not only DOM presence.
	 * Hidden elements, `display: none`, and `visibility: hidden/collapse` do not block PCT.
	 */
	private isElementVisible(element: Element): boolean {
		if (!element.isConnected || element.hasAttribute('hidden') || element.getClientRects().length === 0) {
			return false
		}

		const style = getComputedStyle(element)
		return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
	}

	/**
	 * Reconciles the current DOM with the tracked selector resources:
	 * - visible selector not tracked yet -> emit DISCOVERED
	 * - tracked selector no longer visible -> emit LOADED
	 */
	private scanSelectors(): void {
		this.clearScheduledScan()

		for (const selector of this.selectors) {
			const isVisible = this.hasVisibleElement(selector)
			const monitoredSelector = this.monitoredSelectors.get(selector)

			if (isVisible && !monitoredSelector) {
				const url = this.getLoadingElementUrl(selector)
				const event = Monitor.createDiscoveredEvent(url)
				this.monitoredSelectors.set(selector, {
					id: event.id,
					startTime: performance.now(),
					url,
				})
				this.emitResourceStateChange(event)
			} else if (!isVisible && monitoredSelector) {
				this.completeSelector(selector)
			}
		}
	}

	/**
	 * Batches MutationObserver notifications. DOM updates commonly arrive as several mutations
	 * in the same turn, and scanning once is enough to know whether each selector is visible.
	 */
	private scheduleScan(): void {
		if (this.scanTimeoutId !== undefined) {
			return
		}

		this.scanTimeoutId = setTimeout(() => {
			this.scanSelectors()
		}, 0)
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
			}
		}
		this.selectors = nextSelectors
	}

	/**
	 * Observes DOM changes that can affect selector visibility. Loading element selectors
	 * accept arbitrary CSS selectors, so all attribute changes can be relevant.
	 */
	private setupMutationObserver(): void {
		this.observer = new MutationObserver((mutations) => {
			if (
				mutations.some(
					(mutation) =>
						mutation.type === 'childList' || (mutation.type === 'attributes' && isElement(mutation.target)),
				)
			) {
				this.scheduleScan()
			}
		})

		this.observer.observe(document.documentElement, {
			attributes: true,
			childList: true,
			subtree: true,
		})
	}

	private shouldObserveMutations(): boolean {
		return this.isMonitoring && this.selectors.length > 0
	}

	private syncMutationObserver(): void {
		if (this.shouldObserveMutations()) {
			if (!this.observer) {
				this.setupMutationObserver()
			}

			return
		}

		this.observer?.disconnect()
		this.observer = null
	}
}
