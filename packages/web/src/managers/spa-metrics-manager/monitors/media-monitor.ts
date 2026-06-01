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

import { isElement, isMediaElement } from '../../../types'
import { Monitor } from './monitor'

export class MediaMonitor extends Monitor {
	private isMonitoring = false

	private monitoredMediaElements = new Set<HTMLMediaElement>()

	private observer: MutationObserver | null = null

	start(): void {
		if (this.isMonitoring) {
			diag.warn('PageLoadingManager.MediaMonitor: Already monitoring media elements.')
			return
		}

		this.isMonitoring = true

		this.monitorExistingMediaElements()
		this.setupMutationObserver()

		diag.debug('PageLoadingManager.MediaMonitor: Started monitoring media elements.')
	}

	stop(): void {
		if (!this.isMonitoring) {
			return
		}

		this.observer?.disconnect()
		this.observer = null
		this.stopTimeouts()

		this.isMonitoring = false

		diag.debug('PageLoadingManager.MediaMonitor: Stopped monitoring.')
	}

	private attachMediaListener(element: HTMLMediaElement): void {
		if (this.monitoredMediaElements.has(element)) {
			return
		}

		if (isUrlIgnored(element.src, this.config.ignoreUrls)) {
			return
		}

		if (element instanceof HTMLImageElement && element.loading === 'lazy') {
			return
		}

		this.monitoredMediaElements.add(element)
		const event = Monitor.createDiscoveredEvent(element.src)

		if (this.isElementAlreadyLoaded(element)) {
			this.emitResourceStateChange(Monitor.createLoadedEvent(event.id, element.src, 0))
			return
		} else {
			this.emitResourceStateChange(event)
		}

		const startTime = performance.now()
		const listener = () => {
			this.emitResourceStateChange(
				Monitor.createLoadedEvent(event.id, element.src, performance.now() - startTime),
			)
			element.removeEventListener('load', listener)
			element.removeEventListener('error', errorListener)
		}

		const errorListener = () => {
			this.emitResourceStateChange(Monitor.createErrorEvent(event.id, element.src))
			element.removeEventListener('load', listener)
			element.removeEventListener('error', errorListener)
		}

		element.addEventListener('load', listener, { once: true, passive: true })
		element.addEventListener('error', errorListener, { once: true, passive: true })
	}

	private isElementAlreadyLoaded(element: HTMLMediaElement): boolean {
		if (element instanceof HTMLImageElement) {
			return element.complete && element.naturalHeight !== 0
		}

		if (element instanceof HTMLVideoElement || element instanceof HTMLAudioElement) {
			return element.readyState >= 2
		}

		return false
	}

	private monitorExistingMediaElements(): void {
		const images = document.querySelectorAll('img')
		const videos = document.querySelectorAll('video')
		const audios = document.querySelectorAll('audio')

		const allMediaElements = [
			...Array.from(images),
			...Array.from(videos),
			...Array.from(audios),
		] as HTMLMediaElement[]

		allMediaElements.forEach((element) => this.attachMediaListener(element))
	}

	private setupMutationObserver(): void {
		this.observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (isElement(node)) {
						if (isMediaElement(node)) {
							this.attachMediaListener(node)
						} else {
							const mediaElements = node.querySelectorAll('img, video, audio')
							mediaElements.forEach((mediaElement) => {
								if (isMediaElement(mediaElement)) {
									this.attachMediaListener(mediaElement)
								}
							})
						}
					}
				})
			})
		})

		if (document.body) {
			this.observer.observe(document.body, {
				childList: true,
				subtree: true,
			})
		} else {
			document.addEventListener(
				'DOMContentLoaded',
				() => {
					this.observer?.observe(document.body, {
						childList: true,
						subtree: true,
					})
				},
				{ once: true },
			)
		}
	}
}
