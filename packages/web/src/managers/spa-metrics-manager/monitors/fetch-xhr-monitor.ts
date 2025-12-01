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
import * as shimmer from 'shimmer'

import { Monitor, ResourceState } from './monitor'

declare global {
	interface XMLHttpRequest {
		_splunkMonitorUrl?: string
	}
}

export class FetchXhrMonitor extends Monitor {
	private isMonitoring = false

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

					if (isUrlIgnored(url, self.config.ignoreUrls)) {
						return original(input, init)
					}

					const startTime = performance.now()

					self.config.onResourceStateChange({ state: ResourceState.DISCOVERED, url })

					return original(input, init)
						.then((response) => {
							const loadTime = performance.now() - startTime
							self.config.onResourceStateChange({
								loadTime,
								state: ResourceState.LOADED,
								timestamp: performance.now(),
								url,
							})
							return response
						})
						.catch((error) => {
							self.config.onResourceStateChange({
								state: ResourceState.ERROR,
								timestamp: performance.now(),
								url,
							})
							throw error
						})
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
					if (url && !isUrlIgnored(url, self.config.ignoreUrls)) {
						const startTime = performance.now()

						self.config.onResourceStateChange({ state: ResourceState.DISCOVERED, url })

						const loadHandler = () => {
							const loadTime = performance.now() - startTime
							self.config.onResourceStateChange({
								loadTime,
								state: ResourceState.LOADED,
								timestamp: performance.now(),
								url,
							})
							cleanup()
						}

						const errorHandler = () => {
							self.config.onResourceStateChange({
								state: ResourceState.ERROR,
								timestamp: performance.now(),
								url,
							})
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
}
