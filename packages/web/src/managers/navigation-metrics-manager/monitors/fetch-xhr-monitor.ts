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
import * as shimmer from 'shimmer'

import type { NavigationMetricsMonitor } from '../../../types'

import { Monitor } from './monitor'

declare global {
	interface XMLHttpRequest {
		_splunkMonitorResourceId?: string
		_splunkMonitorUrl?: string
	}
}

export class FetchXhrMonitor extends Monitor {
	protected readonly monitorType: NavigationMetricsMonitor = 'network'

	private readonly activeFetchBodyReaders = new Map<string, ReadableStreamDefaultReader<Uint8Array>>()

	private isMonitoring = false

	cancelFetchBodyReader(resourceId: string): void {
		const reader = this.activeFetchBodyReaders.get(resourceId)
		if (!reader) {
			return
		}

		this.activeFetchBodyReaders.delete(resourceId)
		void reader.cancel().catch(() => {})
	}

	cancelPendingFetchBodyReaders(): void {
		for (const resourceId of this.activeFetchBodyReaders.keys()) {
			this.cancelFetchBodyReader(resourceId)
		}
	}

	start(): void {
		if (this.isMonitoring) {
			diag.warn('PageLoadingManager.FetchXhrMonitor: Already monitoring fetch/XHR requests.')
			return
		}

		this.isMonitoring = true

		this.patchFetch()
		this.patchXhr()

		diag.debug('PageLoadingManager.FetchXhrMonitor: Started monitoring fetch/XHR requests.')
	}

	stop(): void {
		this.cancelPendingFetchBodyReaders()
		if (!this.isMonitoring) {
			return
		}

		this.restoreFetch()
		this.restoreXhr()

		this.isMonitoring = false

		diag.debug('PageLoadingManager.FetchXhrMonitor: Stopped monitoring.')
	}

	private patchFetch(): void {
		if (typeof window === 'undefined' || !window.fetch) {
			return
		}

		const self = this

		shimmer.wrap(
			window,
			'fetch',
			(original) =>
				function wrappedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
					const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

					const event = Monitor.createDiscoveredEvent(url)
					const startTime = performance.now()

					self.emitResourceStateChange(event)
					const isTracked = self.config.isResourceTracked?.(event.id) ?? true

					return original(input, init).then(
						(response) => {
							if (
								!self.config.waitForFetchResponseBody ||
								!response.body ||
								!isTracked ||
								self.config.isResourceTracked?.(event.id) === false
							) {
								self.emitResourceStateChange(
									Monitor.createLoadedEvent(event.id, url, performance.now() - startTime),
								)
								return response
							}

							void self.waitForFetchResponseBody(event.id, response).then(
								(completionReason) => {
									if (self.activeFetchBodyReaders.has(event.id)) {
										self.activeFetchBodyReaders.delete(event.id)
									} else if (response.body) {
										return
									}

									self.emitResourceStateChange(
										Monitor.createLoadedEvent(
											event.id,
											url,
											performance.now() - startTime,
											performance.now(),
											completionReason,
										),
									)
								},
								() => {
									if (self.activeFetchBodyReaders.has(event.id)) {
										self.activeFetchBodyReaders.delete(event.id)
										self.emitResourceStateChange(Monitor.createErrorEvent(event.id, url))
									}
								},
							)

							return response
						},
						(error) => {
							self.emitResourceStateChange(Monitor.createErrorEvent(event.id, url))
							throw error
						},
					)
				},
		)
	}

	private patchXhr(): void {
		const self = this

		shimmer.wrap(
			XMLHttpRequest.prototype,
			'open',
			(original) =>
				function wrappedOpen(
					this: XMLHttpRequest,
					method: string,
					url: string | URL,
					async?: boolean,
					username?: string | null,
					password?: string | null,
				): void {
					this._splunkMonitorUrl = typeof url === 'string' ? url : url.toString()
					return original.call(this, method, url, async ?? true, username, password)
				},
		)

		shimmer.wrap(
			XMLHttpRequest.prototype,
			'send',
			(original) =>
				function wrappedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
					const url = this._splunkMonitorUrl
					if (url) {
						const event = Monitor.createDiscoveredEvent(url)
						const startTime = performance.now()
						this._splunkMonitorResourceId = event.id

						self.emitResourceStateChange(event)

						const loadHandler = () => {
							self.emitResourceStateChange(
								Monitor.createLoadedEvent(event.id, url, performance.now() - startTime),
							)
							cleanup()
						}

						const errorHandler = () => {
							self.emitResourceStateChange(Monitor.createErrorEvent(event.id, url))
							cleanup()
						}

						const cleanup = () => {
							this.removeEventListener('load', loadHandler)
							this.removeEventListener('error', errorHandler)
							this.removeEventListener('abort', errorHandler)
						}

						this.addEventListener('load', loadHandler)
						this.addEventListener('error', errorHandler)
						this.addEventListener('abort', errorHandler)
					}

					return original.call(this, body)
				},
		)
	}

	private restoreFetch(): void {
		shimmer.unwrap(window, 'fetch')
	}

	private restoreXhr(): void {
		shimmer.unwrap(XMLHttpRequest.prototype, 'open')
		shimmer.unwrap(XMLHttpRequest.prototype, 'send')
	}

	private async waitForFetchResponseBody(
		resourceId: string,
		response: Response,
	): Promise<'body_timeout' | undefined> {
		const reader = response.clone().body?.getReader()
		if (!reader) {
			return undefined
		}

		this.activeFetchBodyReaders.set(resourceId, reader)
		let timeoutId: ReturnType<typeof setTimeout> | undefined
		try {
			const bodyRead = (async () => {
				let result = await reader.read()
				while (!result.done) {
					if (this.config.isResourceTracked?.(resourceId) === false) {
						this.config.onResourceUntracked?.(resourceId)
						return
					}

					result = await reader.read()
				}
				return
			})()
			const timeout = new Promise<'body_timeout'>((resolve) => {
				timeoutId = setTimeout(
					() => resolve('body_timeout'),
					this.config.maxFetchResponseBodyWaitTime ?? 180_000,
				)
			})
			const completionReason = await Promise.race([bodyRead, timeout])
			if (completionReason === 'body_timeout') {
				void reader.cancel().catch(() => {})
				return completionReason
			}

			return
		} finally {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId)
			}

			reader.releaseLock()
		}
	}
}
