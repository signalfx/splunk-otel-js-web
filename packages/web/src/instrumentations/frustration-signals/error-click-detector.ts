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

import { Link, Tracer } from '@opentelemetry/api'
import { isUrlIgnored } from '@opentelemetry/core'

import { PrivacyManager } from '../../managers'
import { isElement, isNode, SplunkOtelWebConfig } from '../../types'
import { captureElementDataAttributes, getElementXPath, getTextFromNode } from '../../utils/index'
import { ErrorReportedEvent, ErrorReportedListener, SplunkErrorInstrumentation } from '../splunk-error-instrumentation'
import { RecentClickSpanTracker } from './recent-click-span-tracker'

// ============================================================================
// Types
// ============================================================================

export type ErrorClickOptions = Partial<ResolvedErrorClickConfig> | true

type ResolvedErrorClickConfig = {
	ignoreSelectors: string[]
	ignoreUrls: Array<string | RegExp>
	timeWindowMs: number
}

interface RecentClick {
	consumed: boolean
	target: Node
	targetXpath: string
	timestamp: number
	wallTimestamp: number
}

// ============================================================================
// Default configuration values
// ============================================================================

const DEFAULTS: ResolvedErrorClickConfig = {
	ignoreSelectors: [],
	ignoreUrls: [],
	timeWindowMs: 1000,
}

// ============================================================================
// Detector class
// ============================================================================

export class ErrorClickDetector {
	private clickListener?: (event: MouseEvent) => void

	private errorListener?: ErrorReportedListener

	private recentClicks: RecentClick[] = []

	private constructor(
		private tracer: Tracer,
		private otelConfig: SplunkOtelWebConfig,
		private config: ResolvedErrorClickConfig,
		private errorInstrumentation: SplunkErrorInstrumentation,
		private clickSpanTracker?: RecentClickSpanTracker,
	) {}

	static create(
		tracer: Tracer,
		otelConfig: SplunkOtelWebConfig,
		errorInstrumentation: SplunkErrorInstrumentation,
		clickSpanTracker?: RecentClickSpanTracker,
	): ErrorClickDetector | undefined {
		const config = ErrorClickDetector.resolveConfig(otelConfig)

		if (!config) {
			return undefined
		}

		return new ErrorClickDetector(tracer, otelConfig, config, errorInstrumentation, clickSpanTracker)
	}

	disable(): void {
		if (this.clickListener) {
			document.removeEventListener('click', this.clickListener, true)
			this.clickListener = undefined
		}

		if (this.errorListener) {
			this.errorInstrumentation.removeErrorReportedListener(this.errorListener)
			this.errorListener = undefined
		}

		this.recentClicks = []
	}

	enable(): void {
		if (this.clickListener) {
			return
		}

		this.clickListener = (event: MouseEvent) => {
			const target = event.target

			if (!target || !isNode(target)) {
				return
			}

			this.recordClick(target)
		}
		document.addEventListener('click', this.clickListener, true)

		this.errorListener = (event: ErrorReportedEvent) => {
			this.onErrorReported(event)
		}
		this.errorInstrumentation.addErrorReportedListener(this.errorListener)
	}

	private static normalizeConfig(options: ErrorClickOptions): ResolvedErrorClickConfig {
		if (options === true) {
			return {
				ignoreSelectors: [],
				ignoreUrls: [],
				timeWindowMs: DEFAULTS.timeWindowMs,
			}
		}

		const timeWindowMs =
			typeof options.timeWindowMs === 'number' && options.timeWindowMs > 0
				? options.timeWindowMs
				: DEFAULTS.timeWindowMs

		return {
			ignoreSelectors: Array.isArray(options.ignoreSelectors)
				? options.ignoreSelectors
				: DEFAULTS.ignoreSelectors,
			ignoreUrls: Array.isArray(options.ignoreUrls) ? options.ignoreUrls : DEFAULTS.ignoreUrls,
			timeWindowMs,
		}
	}

	private static resolveConfig(otelConfig: SplunkOtelWebConfig): ResolvedErrorClickConfig | undefined {
		const frustrationSignals = otelConfig.instrumentations?.frustrationSignals

		if (frustrationSignals && typeof frustrationSignals === 'object') {
			const errorClick = frustrationSignals.errorClick

			if (typeof errorClick === 'object' || errorClick === true) {
				return ErrorClickDetector.normalizeConfig(errorClick)
			}
		}

		return undefined
	}

	private emitFrustrationSpan(click: RecentClick, errorEvent: ErrorReportedEvent): void {
		const trackedClick = this.clickSpanTracker?.findClickSpan(
			click.targetXpath,
			errorEvent.timestamp,
			this.config.timeWindowMs,
		)

		const startTime = trackedClick ? trackedClick.startTimeMs : click.wallTimestamp
		const endTime = trackedClick ? trackedClick.endTimeMs : click.wallTimestamp

		const links: Link[] = [{ context: errorEvent.spanContext }]
		if (trackedClick) {
			links.push({ context: trackedClick.spanContext })
		}

		const span = this.tracer.startSpan('frustration', { links, startTime })
		span.setAttribute('frustration_type', 'error')
		span.setAttribute('interaction_type', 'click')
		span.setAttribute('component', 'user-interaction')
		span.setAttribute('target_xpath', click.targetXpath)

		const textValue = getTextFromNode(
			click.target,
			(node) => !PrivacyManager.shouldMaskTextNode(node, this.otelConfig.privacy),
		)
		span.setAttribute('target_text', textValue || `<${click.target.nodeName.toLowerCase()}>`)

		captureElementDataAttributes(span, click.target, this.otelConfig._experimental_dataAttributesToCapture)

		span.setAttribute('error.message', errorEvent.errorMessage)
		span.setAttribute('error.object', errorEvent.errorObject)
		span.setAttribute('error.source', errorEvent.source)

		span.setAttribute('error.span_id', errorEvent.spanContext.spanId)
		if (trackedClick) {
			span.setAttribute('click.span_id', trackedClick.spanContext.spanId)
		}

		span.end(endTime)
	}

	private onErrorReported(event: ErrorReportedEvent): void {
		if (isUrlIgnored(window.location.href, this.config.ignoreUrls)) {
			return
		}

		const currentTime = performance.now()

		this.pruneOldClicks(currentTime)

		for (let i = this.recentClicks.length - 1; i >= 0; i--) {
			const click = this.recentClicks[i]

			if (click.consumed) {
				continue
			}

			if (currentTime - click.timestamp > this.config.timeWindowMs) {
				continue
			}

			const ignored =
				isElement(click.target) &&
				this.config.ignoreSelectors.some((selector) => (click.target as Element).matches(selector))

			if (ignored) {
				continue
			}

			this.emitFrustrationSpan(click, event)
			click.consumed = true
			return
		}
	}

	private pruneOldClicks(currentTime: number): void {
		this.recentClicks = this.recentClicks.filter(
			(click) => currentTime - click.timestamp <= this.config.timeWindowMs,
		)
	}

	private recordClick(target: Node): void {
		const currentTime = performance.now()

		this.pruneOldClicks(currentTime)

		this.recentClicks.push({
			consumed: false,
			target,
			targetXpath: getElementXPath(target, true),
			timestamp: currentTime,
			wallTimestamp: Date.now(),
		})
	}
}
