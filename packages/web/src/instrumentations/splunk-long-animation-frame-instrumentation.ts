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

import { diag, Span } from '@opentelemetry/api'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'

import { SessionManager } from '../managers'
import { SplunkOtelWebConfig } from '../types'
import { VERSION } from '../version'

export const LONG_ANIMATION_FRAME_PERFORMANCE_TYPE = 'long-animation-frame'
export const MAX_LOAF_SCRIPT_SUMMARIES = 3
export const MAX_LOAF_SPANS_PER_SESSION = 100

const MODULE_NAME = 'splunk-loaf'
const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i

export type PerformanceScriptTimingStable = PerformanceEntry & {
	forcedStyleAndLayoutDuration: number
	invoker: string
	invokerType: string
	sourceFunctionName: string
	sourceURL: string
}

type PerformanceLongAnimationFrameTimingStable = PerformanceEntry & {
	blockingDuration: number
	firstUIEventTimestamp: number
	renderStart: number
	scripts: readonly PerformanceScriptTimingStable[]
	styleAndLayoutStart: number
}

type ScriptSummary = {
	duration: number
	forcedStyleAndLayoutDuration: number
	invoker: string
	invokerType: string
	sourceFunctionName: string
	sourceURL: string
}

export function isLongAnimationFrameSupported(): boolean {
	return (window.PerformanceObserver?.supportedEntryTypes ?? []).includes(LONG_ANIMATION_FRAME_PERFORMANCE_TYPE)
}

export function isLoafInstrumentationEnabled(config: boolean | InstrumentationConfig | undefined): boolean {
	if (config === undefined || config === false) {
		return false
	}

	if (typeof config === 'object' && config.enabled === false) {
		return false
	}

	return true
}

export function normalizeLoafSourceUrl(sourceUrl: string): string {
	if (!sourceUrl || sourceUrl.startsWith('<') || /\s/.test(sourceUrl)) {
		return sourceUrl
	}

	const lowercaseSourceUrl = sourceUrl.toLowerCase()
	if (
		SCHEME_PATTERN.test(sourceUrl) &&
		!lowercaseSourceUrl.startsWith('http:') &&
		!lowercaseSourceUrl.startsWith('https:')
	) {
		return sourceUrl
	}

	try {
		const url = new URL(sourceUrl, location.origin)
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return sourceUrl
		}

		url.search = ''
		url.hash = ''
		return url.href
	} catch {
		return sourceUrl
	}
}

export function getLoafScriptSummaries(scripts: readonly PerformanceScriptTimingStable[]): ScriptSummary[] {
	return scripts
		.map((script, index) => ({ index, script }))
		.toSorted((left, right) => {
			const durationDelta = right.script.duration - left.script.duration
			return durationDelta || left.index - right.index
		})
		.slice(0, MAX_LOAF_SCRIPT_SUMMARIES)
		.map(({ script }) => ({
			duration: script.duration,
			forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
			invoker: script.invoker,
			invokerType: script.invokerType,
			sourceFunctionName: script.sourceFunctionName,
			sourceURL: normalizeLoafSourceUrl(script.sourceURL),
		}))
}

function setNumberAttribute(span: Span, name: string, value: number): void {
	if (Number.isFinite(value)) {
		span.setAttribute(name, value)
	}
}

function setStringAttribute(span: Span, name: string, value: string): void {
	if (typeof value === 'string') {
		span.setAttribute(name, value)
	}
}

export class SplunkLongAnimationFrameInstrumentation extends InstrumentationBase {
	private createdSpanCount = 0

	private loafObserver: PerformanceObserver | undefined

	constructor(
		config: InstrumentationConfig = {},
		_otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
	) {
		super(MODULE_NAME, VERSION, Object.assign({}, config))
	}

	disable(): void {
		this.loafObserver?.disconnect()
		this.loafObserver = undefined
	}

	enable(): void {
		if (!isLongAnimationFrameSupported()) {
			return
		}

		this.loafObserver = new PerformanceObserver((list) => {
			list.getEntries().forEach((entry) =>
				this.createSpanFromEntry(entry as PerformanceLongAnimationFrameTimingStable),
			)
		})

		try {
			this.loafObserver.observe({ buffered: true, type: LONG_ANIMATION_FRAME_PERFORMANCE_TYPE })
		} catch (error) {
			diag.warn('[Splunk]: LoAF instrumentation failed to observe long-animation-frame entries.', { error })
			this.loafObserver.disconnect()
			this.loafObserver = undefined
		}
	}

	init(): void {}

	private createSpanFromEntry(entry: PerformanceLongAnimationFrameTimingStable): void {
		if (this.createdSpanCount >= MAX_LOAF_SPANS_PER_SESSION) {
			return
		}

		this.createdSpanCount += 1

		const span = this.tracer.startSpan(LONG_ANIMATION_FRAME_PERFORMANCE_TYPE, {
			startTime: entry.startTime,
		})

		span.setAttribute('component', MODULE_NAME)
		setStringAttribute(span, 'loaf.name', entry.name)
		setStringAttribute(span, 'loaf.entry_type', entry.entryType)
		setNumberAttribute(span, 'loaf.duration', entry.duration)
		setNumberAttribute(span, 'loaf.blocking_duration', entry.blockingDuration)
		setNumberAttribute(span, 'loaf.render_start', entry.renderStart)
		setNumberAttribute(span, 'loaf.style_and_layout_start', entry.styleAndLayoutStart)
		setNumberAttribute(span, 'loaf.first_ui_event_timestamp', entry.firstUIEventTimestamp)

		const scripts = Array.isArray(entry.scripts) ? entry.scripts : []
		setNumberAttribute(span, 'loaf.script_count', scripts.length)

		getLoafScriptSummaries(scripts).forEach((script, index) => {
			const prefix = `loaf.script[${index}]`
			setNumberAttribute(span, `${prefix}.duration`, script.duration)
			setStringAttribute(span, `${prefix}.invoker`, script.invoker)
			setStringAttribute(span, `${prefix}.invoker_type`, script.invokerType)
			setStringAttribute(span, `${prefix}.source_url`, script.sourceURL)
			setStringAttribute(span, `${prefix}.source_function_name`, script.sourceFunctionName)
			setNumberAttribute(span, `${prefix}.forced_style_and_layout_duration`, script.forcedStyleAndLayoutDuration)
		})

		span.end(entry.startTime + entry.duration)
	}
}
