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
import { hrTimeToMilliseconds, isUrlIgnored } from '@opentelemetry/core'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

import { isString, SplunkOtelWebConfig } from '../../types'

// ============================================================================
// Types
// ============================================================================

export type ErrorClickOptions = Partial<ResolvedErrorClickConfig> | true

type ResolvedErrorClickConfig = {
	ignoreUrls: Array<string | RegExp>
	timeWindowMs: number
}

interface RecentClick {
	consumed: boolean
	endTimeMs: number
	span: ReadableSpan
	startTimeMs: number
}

// ============================================================================
// Default configuration values
// ============================================================================

const DEFAULTS: ResolvedErrorClickConfig = {
	ignoreUrls: [],
	timeWindowMs: 1000,
}

// ============================================================================
// Detector class
// ============================================================================

export class ErrorClickDetector {
	private clickSpanEmitterListener?: (span: ReadableSpan) => void

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
		if (this.clickSpanEmitterListener) {
			return
		}

		this.clickSpanEmitterListener = (span: ReadableSpan) => {
			this.onClickSpan(span)
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
		const clickSpan = click.span

		const links: Link[] = [{ context: errorSpan.spanContext() }, { context: clickSpan.spanContext() }]

		const span = this.tracer.startSpan('frustration', { links, startTime: click.startTimeMs })
		span.setAttribute('frustration_type', 'error')
		span.setAttribute('interaction_type', 'click')
		span.setAttribute('component', 'user-interaction')
		const targetXpath = clickSpan.attributes['target_xpath']
		if (isString(targetXpath)) {
			span.setAttribute('target_xpath', targetXpath)
		}

		const targetText = clickSpan.attributes['target_text']
		if (isString(targetText)) {
			span.setAttribute('target_text', targetText)
		}

		for (const [key, value] of Object.entries(clickSpan.attributes)) {
			if (key.startsWith('data.')) {
				span.setAttribute(key, value!)
			}
		}

		const errorMessage = errorSpan.attributes['error.message']
		if (isString(errorMessage)) {
			span.setAttribute('error.message', errorMessage)
		}

		const errorObject = errorSpan.attributes['error.object']
		if (isString(errorObject)) {
			span.setAttribute('error.object', errorObject)
		}

		span.setAttribute('error.source', errorSpan.name)

		span.setAttribute('error.span_id', errorSpan.spanContext().spanId)
		span.setAttribute('click.span_id', clickSpan.spanContext().spanId)

		span.end(click.endTimeMs)
	}

	private onClickSpan(span: ReadableSpan): void {
		if (span.attributes['event_type'] !== 'click') {
			return
		}

		const startTimeMs = hrTimeToMilliseconds(span.startTime)
		const endTimeMs = hrTimeToMilliseconds(span.endTime)

		this.pruneOldClicks(startTimeMs)

		this.recentClicks.push({
			consumed: false,
			endTimeMs,
			span,
			startTimeMs,
		})
	}

	private onErrorSpan(errorSpan: ReadableSpan): void {
		if (isUrlIgnored(window.location.href, this.config.ignoreUrls)) {
			return
		}

		const errorTimestamp = hrTimeToMilliseconds(errorSpan.endTime)

		this.pruneOldClicks(errorTimestamp)

		for (let i = this.recentClicks.length - 1; i >= 0; i--) {
			const click = this.recentClicks[i]

			if (click.consumed) {
				continue
			}

			if (errorTimestamp - click.startTimeMs > this.config.timeWindowMs) {
				continue
			}

			this.emitFrustrationSpan(click, errorSpan)
			click.consumed = true
			return
		}
	}

	private pruneOldClicks(currentTimeMs: number): void {
		this.recentClicks = this.recentClicks.filter(
			(click) => currentTimeMs - click.startTimeMs <= this.config.timeWindowMs,
		)
	}
}
