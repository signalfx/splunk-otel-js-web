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

import { BindOnceFuture, callWithTimeout, globalErrorHandler, unrefTimer } from '@opentelemetry/core'
import type { JsonValue, JsonObject } from 'type-fest'
import type { Log, LogExporter } from './types'

export interface BatchLogProcessorConfig {
	scheduledDelayMillis?: number
}

export class BatchLogProcessor {
	private readonly exportTimeoutMillis = 30000

	private finishedLogs: Log[] = []

	private pageHideListener?: () => void

	private readonly scheduledDelayMillis: number

	private shutdownOnce: BindOnceFuture<void>

	private timer: NodeJS.Timeout | undefined

	private visibilityChangeListener?: () => void

	constructor(
		private readonly exporter: LogExporter,
		config?: BatchLogProcessorConfig,
	) {
		this.scheduledDelayMillis = config?.scheduledDelayMillis ?? 5000
		this.shutdownOnce = new BindOnceFuture(this.shutdown, this)

		this.onInit()
	}

	public forceFlush(): Promise<void> {
		if (this.shutdownOnce.isCalled) {
			return this.shutdownOnce.promise
		}

		return this.flushAll()
	}

	public onEmit(log: Log): void {
		if (this.shutdownOnce.isCalled) {
			return
		}

		this.addToBuffer(log)
	}

	protected onShutdown(): void {
		if (this.visibilityChangeListener) {
			document.removeEventListener('visibilitychange', this.visibilityChangeListener)
		}

		if (this.pageHideListener) {
			document.removeEventListener('pagehide', this.pageHideListener)
		}
	}

	private addToBuffer(log: Log) {
		this.finishedLogs.push(log)
		this.maybeStartTimer()
	}

	private clearTimer() {
		if (this.timer !== undefined) {
			clearTimeout(this.timer)
			this.timer = undefined
		}
	}

	private exportLogs(logs: Log[]): Promise<void> {
		console.debug('🌊 dbg: batch log processor export', logs)
		this.exporter.export(logs)
		return Promise.resolve()
	}

	private flushAll(): Promise<void> {
		return new Promise((resolve, reject) => {
			const promises: Promise<void>[] = []
			promises.push(this.flushOneBatch())

			Promise.all(promises)
				.then(() => {
					resolve()
				})
				.catch(reject)
		})
	}

	private flushOneBatch(): Promise<void> {
		this.clearTimer()
		if (this.finishedLogs.length === 0) {
			return Promise.resolve()
		}

		return new Promise((resolve, reject) => {
			callWithTimeout(
				this.exportLogs(this.finishedLogs.splice(0, this.finishedLogs.length)),
				this.exportTimeoutMillis,
			)
				.then(resolve)
				.catch(reject)
		})
	}

	private maybeStartTimer() {
		if (this.timer !== undefined) {
			return
		}

		this.timer = setTimeout(() => {
			this.flushOneBatch()
				.then(() => {
					if (this.finishedLogs.length > 0) {
						this.clearTimer()
						this.maybeStartTimer()
					}
				})
				.catch((e) => {
					globalErrorHandler(e)
				})
		}, this.scheduledDelayMillis)
		unrefTimer(this.timer)
	}

	private onInit(): void {
		this.visibilityChangeListener = () => {
			if (document.visibilityState === 'hidden') {
				void this.forceFlush()
			}
		}
		this.pageHideListener = () => {
			void this.forceFlush()
		}
		document.addEventListener('visibilitychange', this.visibilityChangeListener)

		document.addEventListener('pagehide', this.pageHideListener)
	}

	private async shutdown(): Promise<void> {
		this.onShutdown()
		await this.flushAll()
	}
}

export function convert(body: JsonValue, timeUnixNano: number, attributes?: JsonObject): Log {
	return {
		body,
		timeUnixNano,
		attributes,
	} as Log
}
