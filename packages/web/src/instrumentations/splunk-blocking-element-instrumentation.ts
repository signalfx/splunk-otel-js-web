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
import { InstrumentationBase } from '@opentelemetry/instrumentation'

import { isElement, type SplunkBlockingElementInstrumentationConfig, type SplunkOtelWebConfig } from '../types'
import { VERSION } from '../version'
import { BLOCKING_ELEMENT_MODULE_NAME } from './blocking-element/constants'
import { ElementSpanTracker } from './blocking-element/element-span-tracker'
import { isBlockingElementInstrumentationEnabled, resolveBlockingElementSelectors } from './blocking-element/support'

export class SplunkBlockingElementInstrumentation extends InstrumentationBase<SplunkBlockingElementInstrumentationConfig> {
	private elementSpanTracker: ElementSpanTracker | undefined

	private observer: MutationObserver | null = null

	private scanTimeoutId: ReturnType<typeof setTimeout> | undefined

	private selectors: string[] = []

	private warnedInvalidSelectors = new Set<string>()

	constructor(
		config: SplunkBlockingElementInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
	) {
		super(BLOCKING_ELEMENT_MODULE_NAME, VERSION, { ...config, enabled: false })
	}

	disable(): void {
		this.clearScheduledScan()
		this.observer?.disconnect()
		this.observer = null
		this.selectors = []
		this.elementSpanTracker?.interruptAll()
		this.elementSpanTracker = undefined
	}

	enable(): void {
		if (!isBlockingElementInstrumentationEnabled(this.otelConfig)) {
			return
		}

		this.selectors = resolveBlockingElementSelectors(this.otelConfig)
		if (this.selectors.length === 0) {
			return
		}

		this.elementSpanTracker = new ElementSpanTracker(this.tracer)
		this.scanSelectors()
		this.setupMutationObserver()
	}

	init(): void {}

	private clearScheduledScan(): void {
		if (this.scanTimeoutId === undefined) {
			return
		}

		clearTimeout(this.scanTimeoutId)
		this.scanTimeoutId = undefined
	}

	private getVisibleElements(selector: string): Element[] {
		let elements: NodeListOf<Element>
		try {
			elements = document.querySelectorAll(selector)
		} catch (error) {
			if (!this.warnedInvalidSelectors.has(selector)) {
				this.warnedInvalidSelectors.add(selector)
				diag.warn('SplunkBlockingElementInstrumentation: Invalid blocking element selector.', {
					error,
					selector,
				})
			}

			return []
		}

		return Array.from(elements).filter((element) => this.isElementVisible(element))
	}

	private isElementVisible(element: Element): boolean {
		if (!element.isConnected || element.hasAttribute('hidden') || element.getClientRects().length === 0) {
			return false
		}

		const style = getComputedStyle(element)
		return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
	}

	private scanSelectors(): void {
		this.clearScheduledScan()

		const elementSpanTracker = this.elementSpanTracker
		if (!elementSpanTracker) {
			return
		}

		const now = performance.now()
		for (const selector of this.selectors) {
			const visibleElements = new Set(this.getVisibleElements(selector))
			const trackedElements = elementSpanTracker.getTrackedElements(selector)

			for (const element of visibleElements) {
				elementSpanTracker.startSpan(selector, element, now)
			}

			for (const element of trackedElements) {
				if (!visibleElements.has(element)) {
					elementSpanTracker.completeSpan(selector, element, now)
				}
			}
		}
	}

	private scheduleScan(): void {
		if (this.scanTimeoutId !== undefined) {
			return
		}

		this.scanTimeoutId = setTimeout(() => {
			this.scanSelectors()
		}, 0)
	}

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
}
