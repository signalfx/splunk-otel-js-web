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

import { generateId } from '../../../utils'

export enum ResourceState {
	DISCOVERED = 'discovered',
	ERROR = 'error',
	LOADED = 'loaded',
	TIMEOUT = 'timeout',
}

export type ResourceStateEvent =
	| { id: string; state: ResourceState.DISCOVERED; url: string }
	| { id: string; state: ResourceState.ERROR; timestamp: number; url: string }
	| { id: string; loadTime: number; state: ResourceState.LOADED; timestamp: number; url: string }
	| { id: string; state: ResourceState.TIMEOUT; timestamp: number; url: string }

export interface MonitorConfig {
	ignoreUrls?: (string | RegExp)[]
	maxResourceWaitingTime?: number
	onResourceStateChange: (event: ResourceStateEvent) => void
}

export abstract class Monitor {
	protected config: MonitorConfig

	private resourceTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

	constructor(config: MonitorConfig) {
		this.config = config
	}

	static createDiscoveredEvent(url: string): ResourceStateEvent & { state: ResourceState.DISCOVERED } {
		return { id: generateId(64), state: ResourceState.DISCOVERED, url }
	}

	static createErrorEvent(id: string, url: string): ResourceStateEvent & { state: ResourceState.ERROR } {
		return { id, state: ResourceState.ERROR, timestamp: performance.now(), url }
	}

	static createLoadedEvent(
		id: string,
		url: string,
		loadTime: number,
	): ResourceStateEvent & { state: ResourceState.LOADED } {
		return { id, loadTime, state: ResourceState.LOADED, timestamp: performance.now(), url }
	}

	static createTimeoutEvent(id: string, url: string): ResourceStateEvent & { state: ResourceState.TIMEOUT } {
		return { id, state: ResourceState.TIMEOUT, timestamp: performance.now(), url }
	}

	protected emitResourceStateChange(event: ResourceStateEvent): void {
		if (event.state === ResourceState.DISCOVERED) {
			this.startResourceTimeout(event.id, event.url)
		} else {
			this.clearResourceTimeout(event.id)
		}

		this.config.onResourceStateChange(event)
	}

	protected stopTimeouts(): void {
		for (const timerId of this.resourceTimeouts.values()) {
			clearTimeout(timerId)
		}
		this.resourceTimeouts.clear()
	}

	private clearResourceTimeout(id: string): void {
		const timerId = this.resourceTimeouts.get(id)
		if (timerId !== undefined) {
			clearTimeout(timerId)
			this.resourceTimeouts.delete(id)
		}
	}

	private startResourceTimeout(id: string, url: string): void {
		if (this.config.maxResourceWaitingTime === undefined) {
			return
		}

		this.resourceTimeouts.set(
			id,
			setTimeout(() => {
				this.resourceTimeouts.delete(id)
				diag.debug('Monitor: Resource exceeded max waiting time', url)
				this.config.onResourceStateChange(Monitor.createTimeoutEvent(id, url))
			}, this.config.maxResourceWaitingTime),
		)
	}

	abstract start(): void

	abstract stop(): void
}
