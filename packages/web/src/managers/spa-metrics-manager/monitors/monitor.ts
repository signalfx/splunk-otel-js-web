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

export enum ResourceState {
	DISCOVERED = 'discovered',
	ERROR = 'error',
	LOADED = 'loaded',
}

export type ResourceStateEvent =
	| { state: ResourceState.DISCOVERED; url: string }
	| { state: ResourceState.ERROR; timestamp: number; url: string }
	| { loadTime: number; state: ResourceState.LOADED; timestamp: number; url: string }

export interface MonitorConfig {
	ignoreUrls?: (string | RegExp)[]
	onResourceStateChange: (event: ResourceStateEvent) => void
}

export abstract class Monitor {
	protected config: MonitorConfig

	constructor(config: MonitorConfig) {
		this.config = config
	}

	abstract start(): void

	abstract stop(): void
}
