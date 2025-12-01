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

import { diag } from '@opentelemetry/api'

import { CollectPromise } from './collect-promise'
import { MediaMonitor } from './monitors'

export class PageLoadTimeManager {
	private _loadingResourcesCount = 0

	private get loadingResourcesCount(): number {
		return this._loadingResourcesCount
	}

	private set loadingResourcesCount(value: number) {
		this._loadingResourcesCount = value

		if (value === 0) {
			this.collectPromise.startQuitTimer()
		} else if (value > 0) {
			this.collectPromise.removeQuitTimer()
		} else {
			throw new Error('PageLoadingManager: Invalid loading resources count.')
		}
	}

	private collectPromise = new CollectPromise()

	private isMonitoring = false

	private mediaMonitor: MediaMonitor

	private startTime: number | null = null

	constructor() {
		this.mediaMonitor = new MediaMonitor({
			onResourceStateChange: (params) => {
				// TODO: implement
			},
		})
	}

	start(): void {
		if (this.isMonitoring) {
			diag.warn('PageLoadingManager: Already monitoring media elements.')
			return
		}

		this.startTime = performance.now()
		this.isMonitoring = true

		this.mediaMonitor.start()

		diag.debug('PageLoadingManager: Started monitoring media elements.', { startTime: this.startTime })
	}

	stop(): void {
		if (!this.isMonitoring) {
			return
		}

		this.isMonitoring = false
		this.mediaMonitor.stop()

		diag.debug('PageLoadingManager: Stopped monitoring.')
	}

	private collect(): Promise<number> {
		this.collectPromise.complete()
		this.collectPromise = new CollectPromise()
		return this.collectPromise.promise
	}
}
