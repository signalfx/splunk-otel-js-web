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

import { SplunkOtelWebConfig } from '../types'
import { VERSION } from '../version'
import { RageClickDetector, RageClickOptions } from './frustration-signals/rage-click-detector'
import { ThrashedCursorDetector, ThrashedCursorOptions } from './frustration-signals/thrashed-cursor-detector'

const MODULE_NAME = 'splunk-frustration-signals'

export interface SplunkFrustrationSignalsInstrumentationConfig extends InstrumentationConfig {
	rageClick?: false | RageClickOptions
	thrashedCursor?: false | ThrashedCursorOptions
}

export class SplunkFrustrationSignalsInstrumentation extends InstrumentationBase<SplunkFrustrationSignalsInstrumentationConfig> {
	private rageClickDetector?: RageClickDetector

	private thrashedCursorDetector?: ThrashedCursorDetector

	constructor(
		config: SplunkFrustrationSignalsInstrumentationConfig = {},
		private otelConfig: SplunkOtelWebConfig,
	) {
		super(MODULE_NAME, VERSION, config)
	}

	disable(): void {
		this.rageClickDetector?.disable()
		this.rageClickDetector = undefined

		this.thrashedCursorDetector?.disable()
		this.thrashedCursorDetector = undefined
	}

	enable(): void {
		if (!this.rageClickDetector) {
			this.rageClickDetector = RageClickDetector.create(this.tracer, this.otelConfig)
		}

		this.rageClickDetector?.enable()

		if (!this.thrashedCursorDetector) {
			this.thrashedCursorDetector = ThrashedCursorDetector.create(this.tracer, this.otelConfig)
		}

		this.thrashedCursorDetector?.enable()
	}

	protected init(): InstrumentationModuleDefinition | InstrumentationModuleDefinition[] | void {}
}
