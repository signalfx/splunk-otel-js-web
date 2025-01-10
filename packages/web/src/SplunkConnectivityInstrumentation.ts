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

const MODULE_NAME = 'splunk-connectivity'

export class SplunkConnectivityInstrumentation extends InstrumentationBase {
	offlineListener: any

	offlineStart: number | null

	onlineListener: any

	constructor(config: InstrumentationConfig = {}) {
		super(MODULE_NAME, VERSION, Object.assign({}, config))
		// For apps with offline support
		this.offlineStart = navigator.onLine ? null : Date.now()
	}

	disable(): void {
		window.removeEventListener('offline', this.offlineListener)
		window.removeEventListener('online', this.onlineListener)
	}

	enable(): void {
		this.offlineListener = () => {
			this.offlineStart = Date.now()
		}

		this.onlineListener = () => {
			if (this.offlineStart) {
				// this could be a span but let's keep it as an "event" for now.
				this._createSpan(false, this.offlineStart)
				this._createSpan(true, Date.now())
			}
		}

		window.addEventListener('offline', this.offlineListener)
		window.addEventListener('online', this.onlineListener)
	}

	init(): void {}

	private _createSpan(online: boolean, startTime: number) {
		const span = this.tracer.startSpan('connectivity', { startTime })
		span.setAttribute('online', online)
		span.end(startTime)
	}
}
