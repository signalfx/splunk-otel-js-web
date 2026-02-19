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

import { Tracer } from '@opentelemetry/api'

import { PrivacyManager } from '../../managers/privacy/privacy-manager'
import { isElement, isNode, SplunkOtelWebConfig } from '../../types'
import { captureElementDataAttributes } from '../../utils/element-attributes'
import { getElementXPath } from '../../utils/index'
import { getTextFromNode } from '../../utils/text'

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

export class RageClickDetector {
	private clickTimesByNode: WeakMap<Node, number[]> = new WeakMap()

	private listener?: (event: MouseEvent) => void

	private constructor(
		private tracer: Tracer,
		private otelConfig: SplunkOtelWebConfig,
		private config: ResolvedRageClickConfig,
	) {}

	static create(tracer: Tracer, otelConfig: SplunkOtelWebConfig): RageClickDetector | undefined {
		const config = RageClickDetector.resolveConfig(otelConfig)

		if (!config) {
			return undefined
		}

		return new RageClickDetector(tracer, otelConfig, config)
	}

	disable(): void {
		this.clickTimesByNode = new WeakMap()

		if (this.listener) {
			document.removeEventListener('click', this.listener, true)
			this.listener = undefined
		}
	}

	enable(): void {
		if (this.listener) {
			return
		}

		this.listener = (event: MouseEvent) => {
			const target = event.target

			if (!target || !isNode(target)) {
				return
			}

			this.processRageClick(target)
		}
		document.addEventListener('click', this.listener, true)
	}

	private static normalizeConfig(options: RageClickOptions): ResolvedRageClickConfig {
		if (options === true) {
			return {
				count: DEFAULT_RAGE_CLICK_COUNT,
				ignoreSelectors: [],
				timeframeMs: DEFAULT_RAGE_CLICK_TIMEFRAME_SECONDS * 1000,
			}
		}

		const count =
			typeof options.count === 'number' && options.count > 0
				? Math.floor(options.count)
				: DEFAULT_RAGE_CLICK_COUNT

		const timeframeSeconds =
			typeof options.timeframeSeconds === 'number' && options.timeframeSeconds > 0
				? options.timeframeSeconds
				: DEFAULT_RAGE_CLICK_TIMEFRAME_SECONDS

		const ignoreSelectors = Array.isArray(options.ignoreSelectors) ? options.ignoreSelectors : []

		return {
			count,
			ignoreSelectors,
			timeframeMs: timeframeSeconds * 1000,
		}
	}

	private static resolveConfig(otelConfig: SplunkOtelWebConfig): ResolvedRageClickConfig | undefined {
		const frustrationSignals = otelConfig.instrumentations?.frustrationSignals ?? {
			rageClick: true,
		}

		if (frustrationSignals && typeof frustrationSignals === 'object') {
			const rageClick = frustrationSignals.rageClick

			if (typeof rageClick === 'object' || rageClick === true) {
				return RageClickDetector.normalizeConfig(rageClick)
			}
		}

		return undefined
	}

	private processRageClick(target: Node): void {
		const currentTime = performance.now()

		let clickTimes = this.clickTimesByNode.get(target) || []
		clickTimes = clickTimes.filter((time) => currentTime - time < this.config.timeframeMs)
		clickTimes.push(currentTime)

		if (clickTimes.length >= this.config.count) {
			clickTimes = []
			const ignored =
				isElement(target) && this.config.ignoreSelectors.some((selector) => target.matches(selector))

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
}
