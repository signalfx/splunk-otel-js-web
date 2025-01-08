/**
 *
 * Copyright 2020-2025 Splunk Inc.
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

import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'
import { VERSION } from './version'

const MODULE_NAME = 'splunk-visibility'

export class SplunkPageVisibilityInstrumentation extends InstrumentationBase {
	unloadListener: any

	unloading: boolean

	visibilityListener: any

	constructor(config: InstrumentationConfig = {}) {
		super(MODULE_NAME, VERSION, Object.assign({}, config))
		this.unloading = false
	}

	disable(): void {
		window.removeEventListener('beforeunload', this.unloadListener)
		window.removeEventListener('visibilitychange', this.visibilityListener)
	}

	enable(): void {
		if (document.hidden) {
			this._createSpan(document.hidden)
		}

		this.unloadListener = () => {
			this.unloading = true
		}

		this.visibilityListener = () => {
			//ignore when page is unloading as it is expected then
			if (!this.unloading) {
				this._createSpan(document.hidden)
			}
		}

		window.addEventListener('beforeunload', this.unloadListener)
		window.addEventListener('visibilitychange', this.visibilityListener)
	}

	init(): void {}

	private _createSpan(hidden: boolean) {
		const now = Date.now()
		const span = this.tracer.startSpan('visibility', { startTime: now })
		span.setAttribute('hidden', hidden)
		span.end(now)
	}
}
