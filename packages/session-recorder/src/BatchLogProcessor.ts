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

import { context } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'
import type { JsonValue, JsonObject } from 'type-fest'
import type { Log, LogExporter } from './types'

export interface BatchLogProcessorConfig {
	scheduledDelayMillis?: number
}

export class BatchLogProcessor {
	exporter: LogExporter

	lastBatchSent: number

	scheduledDelayMillis: number

	timeout: NodeJS.Timeout | undefined

	private logs: Log[] = []

	constructor(exporter: LogExporter, config: BatchLogProcessorConfig) {
		this.scheduledDelayMillis = config?.scheduledDelayMillis || 5000
		this.exporter = exporter

		window.addEventListener('unload', () => {
			this._flushAll()
		})
	}

	_flushAll(): void {
		this.lastBatchSent = Date.now()

		context.with(suppressTracing(context.active()), () => {
			const logsToExport = this.logs.splice(0, this.logs.length)
			this.exporter.export(logsToExport)
		})
	}

	onLog(log: Log): void {
		this.logs.push(log)

		if (this.timeout === undefined) {
			this.timeout = setTimeout(() => {
				this.timeout = undefined
				this._flushAll()
			}, this.scheduledDelayMillis)
		}
	}
}

export function convert(body: JsonValue, timeUnixNano: number, attributes?: JsonObject): Log {
	return {
		body,
		timeUnixNano,
		attributes,
	} as Log
}
