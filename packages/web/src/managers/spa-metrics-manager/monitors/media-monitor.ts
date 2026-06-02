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

import { isElement, isMediaElement } from '../../../types'
import { Monitor } from './monitor'

type MonitoredMediaElement = {
	controller: AbortController
	id: string
	url: string
}

export class MediaMonitor extends Monitor {
	private isMonitoring = false

	private monitoredMediaElementControllers = new Set<AbortController>()

	private monitoredMediaElements = new WeakMap<HTMLMediaElement, MonitoredMediaElement>()

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
		this.monitoredMediaElementControllers.forEach((controller) => controller.abort())
		this.monitoredMediaElementControllers.clear()
		this.monitoredMediaElements = new WeakMap()

		this.isMonitoring = false

		diag.debug('PageLoadingManager.MediaMonitor: Stopped monitoring.')
	}

	private attachMediaListener(element: HTMLMediaElement): void {
		const existingMediaElement = this.monitoredMediaElements.get(element)
		const url = this.getMediaUrl(element)
		if (!url) {
			this.untrackMediaElement(element)
			return
		}

		if (existingMediaElement?.url === url) {
			return
		}

		this.untrackMediaElement(element)

		if (this.isIgnoredUrl(url)) {
			return
		}

		if (element instanceof HTMLImageElement && element.loading === 'lazy') {
			return
		}

		const event = Monitor.createDiscoveredEvent(url)

		if (this.isElementAlreadyLoaded(element)) {
			this.emitResourceStateChange(Monitor.createLoadedEvent(event.id, url, 0))
			return
		}

		if (this.isElementAlreadyFailed(element)) {
			this.emitResourceStateChange(Monitor.createErrorEvent(event.id, url))
			return
		}

		this.emitResourceStateChange(event)

		const startTime = performance.now()
		const loadedEventName = element instanceof HTMLImageElement ? 'load' : 'loadeddata'
		const controller = new AbortController()
		const listener = (loadEvent: Event) => {
			this.emitResourceStateChange(Monitor.createLoadedEvent(event.id, url, performance.now() - startTime))
			this.cleanupMediaElement(loadEvent.currentTarget, controller)
		}

		const errorListener = (errorEvent: Event) => {
			this.emitResourceStateChange(Monitor.createErrorEvent(event.id, url))
			this.cleanupMediaElement(errorEvent.currentTarget, controller)
		}

		this.monitoredMediaElementControllers.add(controller)
		this.monitoredMediaElements.set(element, { controller, id: event.id, url })
		element.addEventListener(loadedEventName, listener, { once: true, passive: true, signal: controller.signal })
		element.addEventListener('error', errorListener, { once: true, passive: true, signal: controller.signal })
		element.addEventListener('abort', errorListener, { once: true, passive: true, signal: controller.signal })
	}

	private attachMediaListeners(node: Node): void {
		if (!isElement(node)) {
			return
		}

		if (isMediaElement(node)) {
			this.attachMediaListener(node)
			return
		}

		node.querySelectorAll('img, video, audio').forEach((mediaElement) => {
			if (isMediaElement(mediaElement)) {
				this.attachMediaListener(mediaElement)
			}
		})
	}

	private cleanupMediaElement(target: EventTarget | null, controller: AbortController): void {
		if (!target || !isElement(target) || !isMediaElement(target)) {
			return
		}

		const mediaElement = this.monitoredMediaElements.get(target)
		if (mediaElement?.controller !== controller) {
			return
		}

		controller.abort()
		this.monitoredMediaElementControllers.delete(controller)
		this.monitoredMediaElements.delete(target)
	}

	private getMediaUrl(element: HTMLMediaElement): string | undefined {
		if (element.getAttribute('src')) {
			return element.src
		}

		const currentSrc = element.currentSrc
		if (currentSrc) {
			return currentSrc
		}

		return
	}

	private isElementAlreadyFailed(element: HTMLMediaElement): boolean {
		return element instanceof HTMLImageElement && element.complete && element.naturalHeight === 0
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
				if (mutation.type === 'attributes' && isElement(mutation.target) && isMediaElement(mutation.target)) {
					this.attachMediaListener(mutation.target)
					return
				}

				mutation.addedNodes.forEach((node) => this.attachMediaListeners(node))
				mutation.removedNodes.forEach((node) => this.untrackMediaElements(node))
			})
		})

		if (document.body) {
			this.observer.observe(document.body, {
				attributeFilter: ['src', 'srcset'],
				attributes: true,
				childList: true,
				subtree: true,
			})
		} else {
			document.addEventListener(
				'DOMContentLoaded',
				() => {
					this.observer?.observe(document.body, {
						attributeFilter: ['src', 'srcset'],
						attributes: true,
						childList: true,
						subtree: true,
					})
				},
				{ once: true },
			)
		}
	}

	private untrackMediaElement(element: HTMLMediaElement): void {
		const mediaElement = this.monitoredMediaElements.get(element)
		if (!mediaElement) {
			return
		}

		this.emitResourceStateChange(Monitor.createErrorEvent(mediaElement.id, mediaElement.url))
		this.cleanupMediaElement(element, mediaElement.controller)
	}

	private untrackMediaElements(node: Node): void {
		if (!isElement(node)) {
			return
		}

		if (isMediaElement(node)) {
			this.untrackMediaElement(node)
			return
		}

		node.querySelectorAll('img, video, audio').forEach((mediaElement) => {
			if (isMediaElement(mediaElement)) {
				this.untrackMediaElement(mediaElement)
			}
		})
	}
}
