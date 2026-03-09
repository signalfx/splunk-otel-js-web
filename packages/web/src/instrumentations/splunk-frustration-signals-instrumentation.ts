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
import { ErrorClickDetector, ErrorClickOptions } from './frustration-signals/error-click-detector'
import { RageClickDetector, RageClickOptions } from './frustration-signals/rage-click-detector'
import { RecentClickSpanTracker } from './frustration-signals/recent-click-span-tracker'
import { ThrashedCursorDetector, ThrashedCursorOptions } from './frustration-signals/thrashed-cursor-detector'
import { SplunkErrorInstrumentation } from './splunk-error-instrumentation'

const MODULE_NAME = 'splunk-frustration-signals'

export const FRUSTRATION_SIGNALS_INSTRUMENTATION_NAME = 'frustrationSignals'

export interface SplunkFrustrationSignalsInstrumentationConfig extends InstrumentationConfig {
	errorClick?: false | ErrorClickOptions
	rageClick?: false | RageClickOptions
	thrashedCursor?: false | ThrashedCursorOptions
}

export class SplunkFrustrationSignalsInstrumentation extends InstrumentationBase<SplunkFrustrationSignalsInstrumentationConfig> {
	private clickSpanTracker?: RecentClickSpanTracker

	private errorClickDetector?: ErrorClickDetector

	private errorInstrumentation?: SplunkErrorInstrumentation

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

		this.errorClickDetector?.disable()
		this.errorClickDetector = undefined
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

		if (!this.errorClickDetector && this.errorInstrumentation) {
			this.errorClickDetector = ErrorClickDetector.create(
				this.tracer,
				this.otelConfig,
				this.errorInstrumentation,
				this.clickSpanTracker,
			)
		}

		this.errorClickDetector?.enable()
	}

	getClickSpanTracker(): RecentClickSpanTracker | undefined {
		return this.clickSpanTracker
	}

	setErrorSource(errorInstrumentation: SplunkErrorInstrumentation, clickSpanTracker?: RecentClickSpanTracker): void {
		this.errorInstrumentation = errorInstrumentation
		this.clickSpanTracker = clickSpanTracker
	}

	protected init(): InstrumentationModuleDefinition | InstrumentationModuleDefinition[] | void {}
}
