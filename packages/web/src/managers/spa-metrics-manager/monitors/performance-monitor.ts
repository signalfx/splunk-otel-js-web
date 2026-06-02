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

import { diag } from '@opentelemetry/api'
import { isUrlIgnored } from '@opentelemetry/core'

import { Monitor, ResourceState } from './monitor'

const RESOURCE_TYPES_TO_MONITOR = new Set(['css', 'font', 'img', 'link', 'other'])

export class PerformanceMonitor extends Monitor {
	private isMonitoring = false

	private observer: PerformanceObserver | null = null

	start(): void {
		if (this.isMonitoring) {
			diag.warn('PageLoadingManager.PerformanceMonitor: Already monitoring.')
			return
		}

		if (typeof PerformanceObserver === 'undefined') {
			diag.warn('PageLoadingManager.PerformanceMonitor: PerformanceObserver not available.')
			return
		}

		this.isMonitoring = true

		this.observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				this.handleResourceEntry(entry as PerformanceResourceTiming)
			}
		})

		try {
			this.observer.observe({ buffered: true, type: 'resource' })
		} catch {
			this.observer.observe({ entryTypes: ['resource'] })
		}

		diag.debug('PageLoadingManager.PerformanceMonitor: Started monitoring resource timing.')
	}

	stop(): void {
		if (!this.isMonitoring) {
			return
		}

		this.observer?.disconnect()
		this.observer = null
		this.isMonitoring = false

		diag.debug('PageLoadingManager.PerformanceMonitor: Stopped monitoring.')
	}

	private handleResourceEntry(entry: PerformanceResourceTiming): void {
		const url = entry.name

		if (!RESOURCE_TYPES_TO_MONITOR.has(entry.initiatorType)) {
			return
		}

		if (isUrlIgnored(url, this.config.ignoreUrls)) {
			return
		}

		const loadTime = entry.responseEnd - entry.startTime

		this.config.onResourceStateChange({
			loadTime,
			state: ResourceState.LOADED,
			timestamp: entry.responseEnd,
			url,
		})

		diag.debug('PageLoadingManager.PerformanceMonitor: Resource loaded', {
			initiatorType: entry.initiatorType,
			loadTime,
			url,
		})
	}
}
