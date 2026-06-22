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

import type { SpanEmitterProcessor } from '../../../span-processors'
import type { SpaMetricsMonitor } from '../../../types'

import { generateId } from '../../../utils'

export enum ResourceState {
	DISCOVERED = 'discovered',
	ERROR = 'error',
	LOADED = 'loaded',
}

type ResourceStateEventWithoutMonitorType =
	| { id: string; state: ResourceState.DISCOVERED; timestamp: number; url: string }
	| { id: string; state: ResourceState.ERROR; timestamp: number; url: string }
	| {
			id: string
			loadTime: number
			state: ResourceState.LOADED
			timestamp: number
			url: string
	  }

export type ResourceStateEvent = ResourceStateEventWithoutMonitorType & {
	monitorType: SpaMetricsMonitor
}

export interface MonitorConfig {
	onResourceStateChange: (event: ResourceStateEvent) => void
	spanEmitter: SpanEmitterProcessor
}

export abstract class Monitor {
	protected config: MonitorConfig

	protected abstract readonly monitorType: SpaMetricsMonitor

	constructor(config: MonitorConfig) {
		this.config = config
	}

	static createDiscoveredEvent(
		url: string,
		timestamp = performance.now(),
	): ResourceStateEventWithoutMonitorType & { state: ResourceState.DISCOVERED } {
		return { id: generateId(64), state: ResourceState.DISCOVERED, timestamp, url }
	}

	static createErrorEvent(
		id: string,
		url: string,
	): ResourceStateEventWithoutMonitorType & { state: ResourceState.ERROR } {
		return { id, state: ResourceState.ERROR, timestamp: performance.now(), url }
	}

	static createLoadedEvent(
		id: string,
		url: string,
		loadTime: number,
		timestamp = performance.now(),
	): ResourceStateEventWithoutMonitorType & { state: ResourceState.LOADED } {
		return { id, loadTime, state: ResourceState.LOADED, timestamp, url }
	}

	protected emitResourceStateChange(event: ResourceStateEventWithoutMonitorType): void {
		this.config.onResourceStateChange({
			...event,
			monitorType: this.monitorType,
		})
	}

	abstract start(): void

	abstract stop(): void
}
