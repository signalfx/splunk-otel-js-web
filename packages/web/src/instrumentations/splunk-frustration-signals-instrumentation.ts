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

import {
	InstrumentationBase,
	InstrumentationConfig,
	InstrumentationModuleDefinition,
} from '@opentelemetry/instrumentation'

import { PrivacyManager } from '../managers/privacy/privacy-manager'
import { isElement, isNode, SplunkOtelWebConfig } from '../types'
import { captureElementDataAttributes } from '../utils/element-attributes'
import { getElementXPath } from '../utils/index'
import { getTextFromNode } from '../utils/text'
import { VERSION } from '../version'

const MODULE_NAME = 'splunk-frustration-signals'

const DEFAULT_RAGE_CLICK_COUNT = 4
const DEFAULT_RAGE_CLICK_TIMEFRAME_SECONDS = 1

type RageClickOptions =
	| {
			count?: number
			ignoreSelectors?: string[]
			timeframeSeconds?: number
	  }
	| true

type ResolvedRageClickConfig = {
	count: number
	ignoreSelectors: string[]
	timeframeMs: number
}

export interface SplunkFrustrationSignalsInstrumentationConfig extends InstrumentationConfig {
	rageClick?: false | RageClickOptions
}

export class SplunkFrustrationSignalsInstrumentation extends InstrumentationBase<SplunkFrustrationSignalsInstrumentationConfig> {
	private clickTimesByNode: WeakMap<Node, number[]> = new WeakMap()

	private rageClickConfig?: ResolvedRageClickConfig

	private rageClickListener?: (event: MouseEvent) => void

	constructor(
		config: SplunkFrustrationSignalsInstrumentationConfig = {},
		private otelConfig: SplunkOtelWebConfig,
	) {
		super(MODULE_NAME, VERSION, config)
	}

	disable(): void {
		this.rageClickConfig = undefined
		this.clickTimesByNode = new WeakMap()
		this.detachRageClickListener()
	}

	enable(): void {
		this.rageClickConfig = this.resolveRageClickConfig()

		if (!this.rageClickConfig) {
			this.detachRageClickListener()
			return
		}

		if (this.rageClickListener) {
			return
		}

		this.rageClickListener = (event: MouseEvent) => {
			const config = this.rageClickConfig
			if (!config) {
				return
			}

			const target = event.target
			if (!target || !isNode(target)) {
				return
			}

			this.processRageClick(target, config)
		}
		document.addEventListener('click', this.rageClickListener, true)
	}

	protected init(): InstrumentationModuleDefinition | InstrumentationModuleDefinition[] | void {}

	private detachRageClickListener(): void {
		if (!this.rageClickListener) {
			return
		}

		document.removeEventListener('click', this.rageClickListener, true)
		this.rageClickListener = undefined
	}

	private normalizeRageClickConfig(config: RageClickOptions): ResolvedRageClickConfig {
		if (config === true) {
			return {
				count: DEFAULT_RAGE_CLICK_COUNT,
				ignoreSelectors: [],
				timeframeMs: DEFAULT_RAGE_CLICK_TIMEFRAME_SECONDS * 1000,
			}
		}

		const count =
			typeof config.count === 'number' && config.count > 0 ? Math.floor(config.count) : DEFAULT_RAGE_CLICK_COUNT
		const timeframeSeconds =
			typeof config.timeframeSeconds === 'number' && config.timeframeSeconds > 0
				? config.timeframeSeconds
				: DEFAULT_RAGE_CLICK_TIMEFRAME_SECONDS

		const ignoreSelectors = Array.isArray(config.ignoreSelectors) ? config.ignoreSelectors : []

		return {
			count,
			ignoreSelectors,
			timeframeMs: timeframeSeconds * 1000,
		}
	}

	private processRageClick(target: Node, config: ResolvedRageClickConfig): void {
		const currentTime = performance.now()

		let clickTimes = this.clickTimesByNode.get(target) || []
		clickTimes = clickTimes.filter((time) => currentTime - time < config.timeframeMs)
		clickTimes.push(currentTime)

		if (clickTimes.length >= config.count) {
			clickTimes = []
			const ignored = isElement(target) && config.ignoreSelectors.some((selector) => target.matches(selector))
			if (!ignored) {
				const startTime = Date.now()
				const span = this.tracer.startSpan('frustration', { startTime })
				span.setAttribute('frustration_type', 'rage')
				span.setAttribute('interaction_type', 'click')
				span.setAttribute('component', 'user-interaction')
				span.setAttribute('target_xpath', getElementXPath(target, true))

				const textValue = getTextFromNode(
					target,
					(node) => !PrivacyManager.shouldMaskTextNode(node, this.otelConfig.privacy),
				)

				span.setAttribute('target_text', textValue || `<${target.nodeName.toLowerCase()}>`)

				captureElementDataAttributes(span, target, this.otelConfig._experimental_dataAttributesToCapture)

				span.end(startTime)
			}
		}

		this.clickTimesByNode.set(target, clickTimes)
	}

	private resolveRageClickConfig(): ResolvedRageClickConfig | undefined {
		// rage clicks are enabled by default
		const frustrationSignals = this.otelConfig.instrumentations?.frustrationSignals ?? {
			rageClick: true,
		}
		if (frustrationSignals && typeof frustrationSignals === 'object') {
			const rageClick = frustrationSignals.rageClick
			if (typeof rageClick === 'object' || rageClick === true) {
				return this.normalizeRageClickConfig(rageClick)
			}
		}
	}
}
