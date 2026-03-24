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
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

import { PrivacyManager } from '../../managers'
import { isElement, isNode, SplunkOtelWebConfig } from '../../types'
import { captureElementDataAttributes, getElementXPath, getTextFromNode } from '../../utils/index'
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

	private clickSpanEmitterListener?: (span: ReadableSpan) => void

	private clickSpanTracker = new RecentClickSpanTracker()

	private errorSpanEmitterListener?: (span: ReadableSpan) => void

	private recentClicks: RecentClick[] = []

	private constructor(
		private tracer: Tracer,
		private otelConfig: SplunkOtelWebConfig,
		private config: ResolvedErrorClickConfig,
	) {}

	static create(tracer: Tracer, otelConfig: SplunkOtelWebConfig): ErrorClickDetector | undefined {
		const config = ErrorClickDetector.resolveConfig(otelConfig)

		if (!config) {
			return undefined
		}

		return new ErrorClickDetector(tracer, otelConfig, config)
	}

	disable(): void {
		if (this.clickListener) {
			document.removeEventListener('click', this.clickListener, true)
			this.clickListener = undefined
		}

		if (this.clickSpanEmitterListener) {
			this.otelConfig.spanEmitter?.removeEventListener('user-interaction', this.clickSpanEmitterListener)
			this.clickSpanEmitterListener = undefined
		}

		if (this.errorSpanEmitterListener) {
			this.otelConfig.spanEmitter?.removeEventListener('error', this.errorSpanEmitterListener)
			this.errorSpanEmitterListener = undefined
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

		this.clickSpanEmitterListener = (span: ReadableSpan) => {
			this.clickSpanTracker.onSpan(span)
		}
		this.otelConfig.spanEmitter?.addEventListener('user-interaction', this.clickSpanEmitterListener)

		this.errorSpanEmitterListener = (span: ReadableSpan) => {
			this.onErrorSpan(span)
		}
		this.otelConfig.spanEmitter?.addEventListener('error', this.errorSpanEmitterListener)
	}

	private static normalizeConfig(options: ErrorClickOptions): ResolvedErrorClickConfig {
		if (options === true) {
			return DEFAULTS
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

	private emitFrustrationSpan(click: RecentClick, errorSpan: ReadableSpan): void {
		const errorTimestamp = errorSpan.endTime[0] * 1000 + errorSpan.endTime[1] / 1e6
		const trackedClick = this.clickSpanTracker.findClickSpan(
			click.targetXpath,
			errorTimestamp,
			this.config.timeWindowMs,
		)

		const startTime = trackedClick ? trackedClick.startTimeMs : click.wallTimestamp
		const endTime = trackedClick ? trackedClick.endTimeMs : click.wallTimestamp

		const links: Link[] = [{ context: errorSpan.spanContext() }]
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

		span.setAttribute('error.message', (errorSpan.attributes['error.message'] as string) ?? '')
		span.setAttribute('error.object', (errorSpan.attributes['error.object'] as string) ?? 'Error')
		span.setAttribute('error.source', errorSpan.name)

		span.setAttribute('error.span_id', errorSpan.spanContext().spanId)
		if (trackedClick) {
			span.setAttribute('click.span_id', trackedClick.spanContext.spanId)
		}

		span.end(endTime)
	}

	private onErrorSpan(errorSpan: ReadableSpan): void {
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

			this.emitFrustrationSpan(click, errorSpan)
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
