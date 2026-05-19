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

import { isElement, isHtmlAudioElement, isHtmlImageElement, isHtmlVideoElement, isMediaElement } from '../../../types'
import { Monitor, MonitorConfig, ResourceState } from './monitor'

type MediaElementKind = 'audio' | 'image' | 'video'

type MediaElementSource = 'existing' | 'mutation'

type MonitoredHtmlMediaElement = HTMLAudioElement | HTMLImageElement | HTMLVideoElement

export type MediaElementPosition = {
	isVisible: boolean
	rect: {
		bottom: number
		height: number
		left: number
		right: number
		top: number
		width: number
	}
}

export type MediaElementStateEvent = {
	discoveredAt: number
	element: MonitoredHtmlMediaElement
	isLazy: boolean
	// PCT ignores lazy images, while VCT can still use lazy images that are in the first viewport.
	isPctEligible: boolean
	kind: MediaElementKind
	loadTime?: number
	position: MediaElementPosition
	readyAt?: number
	source: MediaElementSource
	state: ResourceState
	timestamp: number
	url: string
}

type MonitoredMediaElement = {
	discoveredAt: number
	element: MonitoredHtmlMediaElement
	errorListener?: () => void
	isLazy: boolean
	isPctEligible: boolean
	kind: MediaElementKind
	loadListener?: () => void
	loadStartTime: number
	loadTime?: number
	readyAt?: number
	source: MediaElementSource
	state: ResourceState
	timestamp: number
	url: string
}

type MediaStateListener = (event: MediaElementStateEvent) => void

export interface MediaMonitorConfig extends MonitorConfig {
	onMediaElementStateChange?: MediaStateListener
}

export class MediaMonitor extends Monitor {
	protected config: MediaMonitorConfig

	private isMonitoring = false

	private mediaStateListeners = new Set<MediaStateListener>()

	private monitoredMediaElements = new Map<MonitoredHtmlMediaElement, MonitoredMediaElement>()

	private observer: MutationObserver | null = null

	constructor(config: MediaMonitorConfig) {
		super(config)
		this.config = config
	}

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

		this.isMonitoring = false

		diag.debug('PageLoadingManager.MediaMonitor: Stopped monitoring.')
	}

	subscribe(
		listener: MediaStateListener,
		options: {
			// Replay sends the current media states to late subscribers so trackers do not need their own DOM scan.
			replay: boolean
		},
	): () => void {
		this.mediaStateListeners.add(listener)

		if (options.replay) {
			this.replayMediaStates(listener)
		}

		return () => {
			this.mediaStateListeners.delete(listener)
		}
	}

	private static getElementKind(element: MonitoredHtmlMediaElement): MediaElementKind {
		if (element.localName === 'img') {
			return 'image'
		}

		return element.localName === 'video' ? 'video' : 'audio'
	}

	private static getElementPosition(element: Element): MediaElementPosition {
		const rect = element.getBoundingClientRect()
		const documentElement = document.documentElement
		const scrollLeft = window.scrollX || documentElement?.scrollLeft || document.body?.scrollLeft || 0
		const scrollTop = window.scrollY || documentElement?.scrollTop || document.body?.scrollTop || 0
		let isVisible = rect.width > 0 && rect.height > 0

		let current: Element | null = element
		while (current && isVisible) {
			const style = window.getComputedStyle(current)
			if (
				style.display === 'none' ||
				style.visibility === 'hidden' ||
				style.visibility === 'collapse' ||
				Number.parseFloat(style.opacity || '1') <= 0
			) {
				isVisible = false
			}

			current = current.parentElement
		}

		return {
			isVisible,
			rect: {
				bottom: rect.bottom + scrollTop,
				height: rect.height,
				left: rect.left + scrollLeft,
				right: rect.right + scrollLeft,
				top: rect.top + scrollTop,
				width: rect.width,
			},
		}
	}

	private static getElementUrl(element: MonitoredHtmlMediaElement): string {
		if (isHtmlImageElement(element)) {
			return element.currentSrc || element.src
		}

		return element.currentSrc || element.src || element.querySelector('source')?.src || ''
	}

	private static getLoadEventName(element: MonitoredHtmlMediaElement): 'load' | 'loadeddata' {
		return isHtmlVideoElement(element) || isHtmlAudioElement(element) ? 'loadeddata' : 'load'
	}

	private static isElementAlreadyErrored(element: MonitoredHtmlMediaElement): boolean {
		return isHtmlImageElement(element) && element.complete && element.naturalHeight === 0
	}

	private static isElementAlreadyLoaded(element: MonitoredHtmlMediaElement): boolean {
		if (isHtmlImageElement(element)) {
			return element.complete && element.naturalHeight !== 0
		}

		if (isHtmlVideoElement(element) || isHtmlAudioElement(element)) {
			return element.readyState >= 2
		}

		return false
	}

	private static isPctEligible(element: MonitoredHtmlMediaElement): boolean {
		return !(isHtmlImageElement(element) && element.loading === 'lazy')
	}

	private static removeMediaListeners(mediaElement: MonitoredMediaElement): void {
		if (mediaElement.loadListener) {
			mediaElement.element.removeEventListener(
				MediaMonitor.getLoadEventName(mediaElement.element),
				mediaElement.loadListener,
			)
			mediaElement.loadListener = undefined
		}

		if (mediaElement.errorListener) {
			mediaElement.element.removeEventListener('error', mediaElement.errorListener)
			mediaElement.errorListener = undefined
		}
	}

	private static toMediaElementStateEvent(mediaElement: MonitoredMediaElement): MediaElementStateEvent {
		return {
			discoveredAt: mediaElement.discoveredAt,
			element: mediaElement.element,
			isLazy: mediaElement.isLazy,
			isPctEligible: mediaElement.isPctEligible,
			kind: mediaElement.kind,
			loadTime: mediaElement.loadTime,
			position: MediaMonitor.getElementPosition(mediaElement.element),
			readyAt: mediaElement.readyAt,
			source: mediaElement.source,
			state: mediaElement.state,
			timestamp: mediaElement.timestamp,
			url: mediaElement.url,
		}
	}

	private attachMediaListener(element: MonitoredHtmlMediaElement, source: MediaElementSource): void {
		if (this.monitoredMediaElements.has(element)) {
			return
		}

		const url = MediaMonitor.getElementUrl(element)
		if (url && isUrlIgnored(url, this.config.ignoreUrls)) {
			return
		}

		const timestamp = performance.now()
		const mediaElement: MonitoredMediaElement = {
			discoveredAt: timestamp,
			element,
			isLazy: isHtmlImageElement(element) && element.loading === 'lazy',
			isPctEligible: MediaMonitor.isPctEligible(element),
			kind: MediaMonitor.getElementKind(element),
			loadStartTime: timestamp,
			source,
			state: ResourceState.DISCOVERED,
			timestamp,
			url,
		}

		this.monitoredMediaElements.set(element, mediaElement)
		if (MediaMonitor.isElementAlreadyLoaded(element)) {
			this.markMediaLoaded(mediaElement, timestamp, 0)
			return
		}

		if (MediaMonitor.isElementAlreadyErrored(element)) {
			this.markMediaErrored(mediaElement, timestamp)
			return
		}

		this.emitMediaState(mediaElement)
		if (mediaElement.isPctEligible) {
			this.config.onResourceStateChange({ state: ResourceState.DISCOVERED, url })
		}

		mediaElement.loadListener = () => {
			const loadedAt = performance.now()
			this.markMediaLoaded(mediaElement, loadedAt, loadedAt - mediaElement.loadStartTime)
		}
		mediaElement.errorListener = () => {
			this.markMediaErrored(mediaElement, performance.now())
		}

		element.addEventListener(MediaMonitor.getLoadEventName(element), mediaElement.loadListener, {
			once: true,
			passive: true,
		})
		element.addEventListener('error', mediaElement.errorListener, { once: true, passive: true })
	}

	private emitMediaState(mediaElement: MonitoredMediaElement): void {
		const event = MediaMonitor.toMediaElementStateEvent(mediaElement)

		this.config.onMediaElementStateChange?.(event)
		for (const listener of this.mediaStateListeners) {
			listener(event)
		}
	}

	private markMediaErrored(mediaElement: MonitoredMediaElement, timestamp: number): void {
		mediaElement.state = ResourceState.ERROR
		mediaElement.timestamp = timestamp
		MediaMonitor.removeMediaListeners(mediaElement)
		this.emitMediaState(mediaElement)

		if (mediaElement.isPctEligible) {
			this.config.onResourceStateChange({
				state: ResourceState.ERROR,
				timestamp,
				url: mediaElement.url,
			})
		}
	}

	private markMediaLoaded(mediaElement: MonitoredMediaElement, timestamp: number, loadTime: number): void {
		mediaElement.loadTime = loadTime
		mediaElement.readyAt = timestamp
		mediaElement.state = ResourceState.LOADED
		mediaElement.timestamp = timestamp
		MediaMonitor.removeMediaListeners(mediaElement)
		this.emitMediaState(mediaElement)

		if (mediaElement.isPctEligible) {
			this.config.onResourceStateChange({
				loadTime,
				state: ResourceState.LOADED,
				timestamp,
				url: mediaElement.url,
			})
		}
	}

	private monitorExistingMediaElements(): void {
		const images = document.querySelectorAll('img')
		const videos = document.querySelectorAll('video')
		const audios = document.querySelectorAll('audio')

		const allMediaElements: MonitoredHtmlMediaElement[] = [
			...Array.from(images),
			...Array.from(videos),
			...Array.from(audios),
		]

		allMediaElements.forEach((element) => this.attachMediaListener(element, 'existing'))
	}

	private replayMediaStates(listener: MediaStateListener): void {
		for (const mediaElement of this.monitoredMediaElements.values()) {
			listener(MediaMonitor.toMediaElementStateEvent(mediaElement))
		}
	}

	private setupMutationObserver(): void {
		this.observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (isElement(node)) {
						if (isMediaElement(node)) {
							this.attachMediaListener(node, 'mutation')
						} else {
							const mediaElements = node.querySelectorAll('img, video, audio')
							mediaElements.forEach((mediaElement) => {
								if (isMediaElement(mediaElement)) {
									this.attachMediaListener(mediaElement, 'mutation')
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
					this.monitorExistingMediaElements()

					if (document.body) {
						this.observer?.observe(document.body, {
							childList: true,
							subtree: true,
						})
					}
				},
				{ once: true },
			)
		}
	}
}
