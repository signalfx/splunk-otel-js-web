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

export type DeadClickOptions = Partial<ResolvedDeadClickConfig> | true

type ResolvedDeadClickConfig = {
	ignoreUrls: Array<string | RegExp>
	timeWindowMs: number
}

interface PendingClick {
	endTimeMs: number
	networkDetected: boolean
	registeredAt: number
	span: ReadableSpan
	startTimeMs: number
	timer: ReturnType<typeof setTimeout>
}

// ============================================================================
// Default configuration values
// ============================================================================

const DEFAULTS: ResolvedDeadClickConfig = {
	ignoreUrls: [],
	timeWindowMs: 1000,
}

const NETWORK_LOOKBACK_MS = 100

// ============================================================================
// Detector class
// ============================================================================

export class DeadClickDetector {
	private clickSpanEmitterListener?: (span: ReadableSpan) => void

	private domContentLoadedListener?: () => void

	private fetchSpanEmitterListener?: (span: ReadableSpan) => void

	private lastMutationTime = -Infinity

	private mutationObserver?: MutationObserver

	private pendingClicks: PendingClick[] = []

	private processedClickTraceIds: Map<string, number> = new Map()

	private recentNetworkStartTimes: number[] = []

	private xhrSpanEmitterListener?: (span: ReadableSpan) => void

	private constructor(
		private tracer: Tracer,
		private otelConfig: SplunkOtelWebConfig,
		private config: ResolvedDeadClickConfig,
	) {}

	static create(tracer: Tracer, otelConfig: SplunkOtelWebConfig): DeadClickDetector | undefined {
		const config = DeadClickDetector.resolveConfig(otelConfig)

		if (!config) {
			return undefined
		}

		return new DeadClickDetector(tracer, otelConfig, config)
	}

	disable(): void {
		if (this.domContentLoadedListener) {
			document.removeEventListener('DOMContentLoaded', this.domContentLoadedListener)
			this.domContentLoadedListener = undefined
		}

		if (this.clickSpanEmitterListener) {
			this.otelConfig.spanEmitter?.removeEventListener('user-interaction', this.clickSpanEmitterListener)
			this.clickSpanEmitterListener = undefined
		}

		if (this.fetchSpanEmitterListener) {
			this.otelConfig.spanEmitter?.removeEventListener('fetch:start', this.fetchSpanEmitterListener)
			this.fetchSpanEmitterListener = undefined
		}

		if (this.xhrSpanEmitterListener) {
			this.otelConfig.spanEmitter?.removeEventListener('xml-http-request:start', this.xhrSpanEmitterListener)
			this.xhrSpanEmitterListener = undefined
		}

		this.mutationObserver?.disconnect()
		this.mutationObserver = undefined

		for (const pending of this.pendingClicks) {
			clearTimeout(pending.timer)
		}

		this.pendingClicks = []
		this.processedClickTraceIds.clear()
		this.recentNetworkStartTimes = []
		this.lastMutationTime = -Infinity
	}

	enable(): void {
		if (this.clickSpanEmitterListener) {
			return
		}

		this.mutationObserver = new MutationObserver(() => {
			this.lastMutationTime = performance.now()
		})

		const observeMutations = () => {
			const mutationTarget = document.body ?? document.documentElement
			if (mutationTarget) {
				this.mutationObserver?.observe(mutationTarget, {
					attributes: true,
					characterData: true,
					childList: true,
					subtree: true,
				})
			}
		}

		if (document.body) {
			observeMutations()
		} else {
			this.domContentLoadedListener = observeMutations
			document.addEventListener('DOMContentLoaded', observeMutations, { once: true })
		}

		this.clickSpanEmitterListener = (span: ReadableSpan) => {
			this.onClickSpan(span)
		}
		this.otelConfig.spanEmitter?.addEventListener('user-interaction', this.clickSpanEmitterListener)

		this.fetchSpanEmitterListener = (span: ReadableSpan) => {
			this.onNetworkSpan(span)
		}
		this.otelConfig.spanEmitter?.addEventListener('fetch:start', this.fetchSpanEmitterListener)

		this.xhrSpanEmitterListener = (span: ReadableSpan) => {
			this.onNetworkSpan(span)
		}
		this.otelConfig.spanEmitter?.addEventListener('xml-http-request:start', this.xhrSpanEmitterListener)
	}

	private static normalizeConfig(options: DeadClickOptions): ResolvedDeadClickConfig {
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

	private static resolveConfig(otelConfig: SplunkOtelWebConfig): ResolvedDeadClickConfig | undefined {
		const frustrationSignals = otelConfig.instrumentations?.frustrationSignals

		if (frustrationSignals && typeof frustrationSignals === 'object') {
			const deadClick = frustrationSignals.deadClick

			if (typeof deadClick === 'object' || deadClick === true) {
				return DeadClickDetector.normalizeConfig(deadClick)
			}
		}

		return undefined
	}

	private emitFrustrationSpan(pending: PendingClick): void {
		const clickSpan = pending.span

		const links: Link[] = [{ context: clickSpan.spanContext() }]

		const span = this.tracer.startSpan('frustration', { links, startTime: pending.startTimeMs })
		span.setAttribute('frustration_type', 'dead')
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

		span.setAttribute('click.span_id', clickSpan.spanContext().spanId)

		span.end(pending.endTimeMs)
	}

	private evaluateClick(pending: PendingClick): void {
		const index = this.pendingClicks.indexOf(pending)
		if (index !== -1) {
			this.pendingClicks.splice(index, 1)
		}

		const mutationDetected = this.lastMutationTime > pending.registeredAt

		if (pending.networkDetected || mutationDetected) {
			return
		}

		this.emitFrustrationSpan(pending)
	}

	private hasRecentNetworkForClick(clickStartTimeMs: number): boolean {
		for (const networkStartTimeMs of this.recentNetworkStartTimes) {
			if (this.isNetworkInClickWindow(networkStartTimeMs, clickStartTimeMs)) {
				return true
			}
		}

		return false
	}

	private isInteractiveElement(span: ReadableSpan): boolean {
		return span.attributes['target_interactive'] === true
	}

	private isNetworkInClickWindow(networkStartTimeMs: number, clickStartTimeMs: number): boolean {
		return (
			networkStartTimeMs >= clickStartTimeMs - NETWORK_LOOKBACK_MS &&
			networkStartTimeMs <= clickStartTimeMs + this.config.timeWindowMs
		)
	}

	private onClickSpan(span: ReadableSpan): void {
		if (span.attributes['event_type'] !== 'click') {
			return
		}

		if (isUrlIgnored(window.location.href, this.config.ignoreUrls)) {
			return
		}

		if (!this.isInteractiveElement(span)) {
			return
		}

		const startTimeMs = hrTimeToMilliseconds(span.startTime)
		const endTimeMs = hrTimeToMilliseconds(span.endTime)
		const traceId = span.spanContext().traceId

		this.pruneProcessedClickTraceIds(startTimeMs)
		if (this.processedClickTraceIds.has(traceId)) {
			return
		}

		this.processedClickTraceIds.set(traceId, startTimeMs)
		this.pruneRecentNetworkStarts(startTimeMs)

		const pending: PendingClick = {
			endTimeMs,
			networkDetected: this.hasRecentNetworkForClick(startTimeMs),
			registeredAt: performance.now(),
			span,
			startTimeMs,
			timer: setTimeout(() => {
				this.evaluateClick(pending)
			}, this.config.timeWindowMs),
		}

		this.pendingClicks.push(pending)
	}

	private onNetworkSpan(networkSpan: ReadableSpan): void {
		const networkStartMs = hrTimeToMilliseconds(networkSpan.startTime)
		this.pruneRecentNetworkStarts(networkStartMs)
		this.recentNetworkStartTimes.push(networkStartMs)

		for (const pending of this.pendingClicks) {
			if (this.isNetworkInClickWindow(networkStartMs, pending.startTimeMs)) {
				pending.networkDetected = true
			}
		}
	}

	private pruneProcessedClickTraceIds(referenceTimeMs: number): void {
		const earliestRelevantClickStart = referenceTimeMs - this.config.timeWindowMs

		for (const [traceId, clickStartTimeMs] of this.processedClickTraceIds.entries()) {
			if (clickStartTimeMs < earliestRelevantClickStart) {
				this.processedClickTraceIds.delete(traceId)
			}
		}
	}

	private pruneRecentNetworkStarts(referenceTimeMs: number): void {
		const earliestRelevantNetworkStart = referenceTimeMs - this.config.timeWindowMs - NETWORK_LOOKBACK_MS

		this.recentNetworkStartTimes = this.recentNetworkStartTimes.filter(
			(networkStartTimeMs) => networkStartTimeMs >= earliestRelevantNetworkStart,
		)
	}
}
