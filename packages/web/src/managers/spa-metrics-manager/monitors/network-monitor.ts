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
import { hrTimeToMilliseconds } from '@opentelemetry/core'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'

import type { SpaMetricsMonitor } from '../../../types'

import { Monitor } from './monitor'

const NETWORK_SPAN_COMPONENTS = ['fetch', 'xml-http-request'] as const

type NetworkSpanComponent = (typeof NETWORK_SPAN_COMPONENTS)[number]

export class NetworkMonitor extends Monitor {
	protected readonly monitorType: SpaMetricsMonitor = 'network'

	private isMonitoring = false

	start(): void {
		if (this.isMonitoring) {
			diag.warn('PageLoadingManager.NetworkMonitor: Already monitoring fetch/XHR spans.')
			return
		}

		for (const component of NETWORK_SPAN_COMPONENTS) {
			this.config.spanEmitter.addEventListener(`${component}:start`, this.onSpanStart)
			this.config.spanEmitter.addEventListener(`${component}:end`, this.onSpanEnd)
		}

		this.isMonitoring = true

		diag.debug('PageLoadingManager.NetworkMonitor: Started monitoring fetch/XHR spans.')
	}

	stop(): void {
		if (!this.isMonitoring) {
			return
		}

		for (const component of NETWORK_SPAN_COMPONENTS) {
			this.config.spanEmitter.removeEventListener(`${component}:start`, this.onSpanStart)
			this.config.spanEmitter.removeEventListener(`${component}:end`, this.onSpanEnd)
		}

		this.isMonitoring = false

		diag.debug('PageLoadingManager.NetworkMonitor: Stopped monitoring.')
	}

	private static getResourceId(span: ReadableSpan, component: NetworkSpanComponent): string {
		return `${component}:${span.spanContext().spanId}`
	}

	private static getSpanComponent(span: ReadableSpan): NetworkSpanComponent | undefined {
		const component = span.attributes['component']
		if (!NETWORK_SPAN_COMPONENTS.includes(component as NetworkSpanComponent)) {
			return
		}

		return component as NetworkSpanComponent
	}

	private getSpanUrl(span: ReadableSpan): string | undefined {
		const url = span.attributes['http.url']
		return typeof url === 'string' ? url : undefined
	}

	private readonly onSpanEnd = (span: ReadableSpan): void => {
		const component = NetworkMonitor.getSpanComponent(span)
		const url = this.getSpanUrl(span)
		if (!component || !url) {
			return
		}

		const endTimestamp = hrTimeToMilliseconds(span.endTime) - performance.timeOrigin
		const loadTime = Math.max(hrTimeToMilliseconds(span.endTime) - hrTimeToMilliseconds(span.startTime), 0)

		this.emitResourceStateChange(
			Monitor.createLoadedEvent(NetworkMonitor.getResourceId(span, component), url, loadTime, endTimestamp),
		)
	}

	private readonly onSpanStart = (span: ReadableSpan): void => {
		const component = NetworkMonitor.getSpanComponent(span)
		const url = this.getSpanUrl(span)
		if (!component || !url) {
			return
		}

		const startTimestamp = hrTimeToMilliseconds(span.startTime) - performance.timeOrigin
		this.emitResourceStateChange({
			...Monitor.createDiscoveredEvent(url, startTimestamp),
			id: NetworkMonitor.getResourceId(span, component),
		})
	}
}
