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

import type { SessionManager, SpaMetricsManager } from '../managers'
import type { ElementVisibilityChangeEvent, ElementVisibilityObserver } from '../observers/element-visibility-observer'
import type { SplunkBlockingElementInstrumentationConfig, SplunkOtelWebConfig } from '../types'

import { VERSION } from '../version'
import { BLOCKING_ELEMENT_MODULE_NAME } from './blocking-element/constants'
import { ElementSpanTracker } from './blocking-element/element-span-tracker'
import { isBlockingElementInstrumentationEnabled, resolveBlockingElementSelectors } from './blocking-element/support'

/**
 * DOM watching itself is delegated to the shared ElementVisibilityObserver — this class only
 * derives per-element span lifecycle from the per-element events it receives.
 */
export class SplunkBlockingElementInstrumentation extends InstrumentationBase<SplunkBlockingElementInstrumentationConfig> {
	private readonly consumerId = Symbol('splunk-blocking-element')

	private elementSpanTracker: ElementSpanTracker | undefined

	private readonly elementVisibilityObserver: ElementVisibilityObserver

	private selectors: string[] = []

	private warnedInvalidSelectors = new Set<string>()

	constructor(
		config: SplunkBlockingElementInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
		_sessionManager?: SessionManager,
		_spaMetricsManager?: SpaMetricsManager,
		elementVisibilityObserver?: ElementVisibilityObserver,
	) {
		super(BLOCKING_ELEMENT_MODULE_NAME, VERSION, { ...config, enabled: false })
		if (!elementVisibilityObserver) {
			throw new Error('SplunkBlockingElementInstrumentation requires elementVisibilityObserver.')
		}

		this.elementVisibilityObserver = elementVisibilityObserver
	}

	disable(): void {
		// Interrupt before unwatch() so open spans end as 'interrupted', not 'completed' — unwatch()'s
		// synthesized visible:false events would otherwise reach handleVisibilityChange and complete
		// them as if they'd resolved normally, same ordering LoadingElementMonitor.stop() relies on.
		this.elementSpanTracker?.interruptAll()
		this.elementSpanTracker = undefined
		this.selectors = []
		this.elementVisibilityObserver.unwatch(this.consumerId)
	}

	enable(): void {
		if (!isBlockingElementInstrumentationEnabled(this.otelConfig)) {
			return
		}

		this.selectors = resolveBlockingElementSelectors(this.otelConfig)
		if (this.selectors.length === 0) {
			return
		}

		this.elementSpanTracker = new ElementSpanTracker(this.tracer, this.selectors)
		this.elementVisibilityObserver.watch(this.consumerId, this.selectors, this.handleVisibilityChange)
	}

	init(): void {}

	private readonly handleVisibilityChange = (event: ElementVisibilityChangeEvent): void => {
		const elementSpanTracker = this.elementSpanTracker
		if (!elementSpanTracker) {
			return
		}

		const { element, visible } = event
		const now = performance.now()

		if (!visible) {
			// Visibility is a property of the element, not the (selector, element) pair — an element
			// stopping matching one selector while still matching another can't happen from a single
			// visible:false event, so no re-check against other selectors is needed here.
			elementSpanTracker.completeSpan(element, now)
			return
		}

		const matchedSelectors = this.selectors.filter((selector) => this.matchesSelector(element, selector))
		elementSpanTracker.startSpan(element, matchedSelectors, now)
	}

	private matchesSelector(element: Element, selector: string): boolean {
		try {
			return element.matches(selector)
		} catch (error) {
			if (!this.warnedInvalidSelectors.has(selector)) {
				this.warnedInvalidSelectors.add(selector)
				diag.warn('SplunkBlockingElementInstrumentation: Invalid blocking element selector.', {
					error,
					selector,
				})
			}

			return false
		}
	}
}
