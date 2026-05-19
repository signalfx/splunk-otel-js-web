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

import { MediaElementPosition, MediaElementStateEvent, MediaMonitor, ResourceState } from './monitors'
import { QuietPeriodAwaiter } from './quiet-period-awaiter'

type ViewportRect = {
	bottom: number
	left: number
	right: number
	top: number
}

type Candidate = {
	readyAt?: number
}

export type VisualCompleteResult = {
	vct?: number
}

export interface VisualCompleteTrackerConfig {
	mediaMonitor: MediaMonitor
	quietMediaTime: number
}

export class VisualCompleteTracker {
	private activePromiseResolve: ((result: VisualCompleteResult) => void) | undefined

	private candidates = new WeakMap<Element, Candidate>()

	// Once a DOM-added media candidate arrives after the VCT media quiet gap, all later DOM-added media is ignored for VCT.
	private hasAcceptedDomAddedMedia = true

	private initialViewport: ViewportRect = {
		bottom: 0,
		left: 0,
		right: 0,
		top: 0,
	}

	private lastDomAddedMediaAttachmentTime = 0

	private latestCandidateTimestamp = 0

	private latestReadyTimestamp: number | undefined

	private readonly mediaMonitor: MediaMonitor

	private pendingCandidatesCount = 0

	private readonly quietMediaTime: number

	private quietPeriodAwaiter: QuietPeriodAwaiter | undefined

	private startTime = 0

	private unsubscribeMediaMonitor: (() => void) | undefined

	constructor(config: VisualCompleteTrackerConfig) {
		this.mediaMonitor = config.mediaMonitor
		this.quietMediaTime = config.quietMediaTime
	}

	complete(): void {
		const quietPeriodAwaiter = this.quietPeriodAwaiter
		if (!quietPeriodAwaiter) {
			return
		}

		quietPeriodAwaiter.complete({ areResourcesStillLoading: this.pendingCandidatesCount > 0 })
		this.finishActiveMeasurement(quietPeriodAwaiter)
	}

	start({ startTime }: { startTime: number }): Promise<VisualCompleteResult> {
		this.complete()
		this.resetMeasurement(startTime)

		const quietPeriodAwaiter = new QuietPeriodAwaiter(this.quietMediaTime, startTime)
		this.quietPeriodAwaiter = quietPeriodAwaiter
		const promise = new Promise<VisualCompleteResult>((resolve) => {
			this.activePromiseResolve = resolve
		})

		this.unsubscribeMediaMonitor = this.mediaMonitor.subscribe(this.onMediaElementStateChange, { replay: true })
		this.startQuietTimer(this.latestCandidateTimestamp)
		void quietPeriodAwaiter.promise.then(() => this.finishActiveMeasurement(quietPeriodAwaiter))

		return promise
	}

	stop(): void {
		this.complete()
	}

	private addCandidate(event: MediaElementStateEvent): Candidate | undefined {
		const existingCandidate = this.candidates.get(event.element)
		if (existingCandidate) {
			return existingCandidate
		}

		if (!this.isCandidateEligible(event)) {
			return
		}

		const candidate: Candidate = {}
		this.candidates.set(event.element, candidate)
		this.latestCandidateTimestamp = Math.max(this.latestCandidateTimestamp, event.discoveredAt)
		this.removeQuietTimer()

		if (event.state !== ResourceState.LOADED && event.state !== ResourceState.ERROR) {
			this.pendingCandidatesCount += 1
		}

		return candidate
	}

	private computeCurrentViewport(): ViewportRect {
		const documentElement = document.documentElement
		const viewportWidth =
			window.innerWidth && documentElement?.clientWidth
				? Math.min(window.innerWidth, documentElement.clientWidth)
				: window.innerWidth || documentElement?.clientWidth || document.body?.clientWidth || 0
		const viewportHeight =
			window.innerHeight && documentElement?.clientHeight
				? Math.min(window.innerHeight, documentElement.clientHeight)
				: window.innerHeight || documentElement?.clientHeight || document.body?.clientHeight || 0

		const left = window.scrollX || documentElement?.scrollLeft || document.body?.scrollLeft || 0
		const top = window.scrollY || documentElement?.scrollTop || document.body?.scrollTop || 0

		return {
			bottom: top + viewportHeight,
			left,
			right: left + viewportWidth,
			top,
		}
	}

	private finishActiveMeasurement(quietPeriodAwaiter: QuietPeriodAwaiter): void {
		if (this.quietPeriodAwaiter !== quietPeriodAwaiter) {
			return
		}

		const result = this.getVisualCompleteResult()
		const resolve = this.activePromiseResolve
		this.stopMeasurement()
		resolve?.(result)
		diag.debug('VisualCompleteTracker: Complete', result)
	}

	private getVisualCompleteResult(): VisualCompleteResult {
		if (this.latestReadyTimestamp === undefined) {
			return {}
		}

		return {
			vct: Math.trunc(Math.max(this.latestReadyTimestamp - this.startTime, 0)),
		}
	}

	private isCandidateEligible(event: MediaElementStateEvent): boolean {
		if (event.kind !== 'image' && event.kind !== 'video') {
			return false
		}

		if (!this.isDomAddedMediaEligible(event) || !this.isPositionInInitialViewport(event.position)) {
			return false
		}

		return true
	}

	private isDomAddedMediaEligible(event: MediaElementStateEvent): boolean {
		if (event.discoveredAt <= this.startTime) {
			return true
		}

		if (!this.hasAcceptedDomAddedMedia) {
			return false
		}

		if (event.discoveredAt - this.lastDomAddedMediaAttachmentTime > this.quietMediaTime) {
			this.hasAcceptedDomAddedMedia = false
			return false
		}

		this.lastDomAddedMediaAttachmentTime = event.discoveredAt
		return true
	}

	private isPositionInInitialViewport(position: MediaElementPosition): boolean {
		const { rect } = position
		if (!position.isVisible || rect.width <= 0 || rect.height <= 0) {
			return false
		}

		return (
			rect.bottom >= this.initialViewport.top &&
			rect.top <= this.initialViewport.bottom &&
			rect.right >= this.initialViewport.left &&
			rect.left <= this.initialViewport.right
		)
	}

	private markCandidateErrored(candidate: Candidate): void {
		if (candidate.readyAt !== undefined) {
			return
		}

		this.pendingCandidatesCount = Math.max(this.pendingCandidatesCount - 1, 0)
		if (this.pendingCandidatesCount === 0) {
			this.startQuietTimer(this.latestCandidateTimestamp)
		}
	}

	private markCandidateReady(candidate: Candidate, event: MediaElementStateEvent): void {
		if (candidate.readyAt !== undefined) {
			return
		}

		const readyAt = Math.max(event.readyAt ?? event.timestamp, this.startTime)
		candidate.readyAt = readyAt
		this.latestCandidateTimestamp = Math.max(this.latestCandidateTimestamp, readyAt)
		this.latestReadyTimestamp = Math.max(this.latestReadyTimestamp ?? 0, readyAt)
		this.pendingCandidatesCount = Math.max(this.pendingCandidatesCount - 1, 0)

		if (this.pendingCandidatesCount === 0) {
			this.startQuietTimer(this.latestCandidateTimestamp)
		}
	}

	private onMediaElementStateChange = (event: MediaElementStateEvent): void => {
		if (!this.quietPeriodAwaiter) {
			return
		}

		const candidate = this.addCandidate(event)
		if (!candidate) {
			return
		}

		if (event.state === ResourceState.LOADED) {
			this.markCandidateReady(candidate, event)
		} else if (event.state === ResourceState.ERROR) {
			this.markCandidateErrored(candidate)
		}
	}

	private removeQuietTimer(): void {
		this.quietPeriodAwaiter?.removeQuietTimer()
	}

	private resetMeasurement(startTime: number): void {
		this.candidates = new WeakMap<Element, Candidate>()
		this.hasAcceptedDomAddedMedia = true
		this.initialViewport = this.computeCurrentViewport()
		this.lastDomAddedMediaAttachmentTime = startTime
		this.latestCandidateTimestamp = startTime
		this.latestReadyTimestamp = undefined
		this.pendingCandidatesCount = 0
		this.startTime = startTime
	}

	private startQuietTimer(timestamp: number): void {
		if (this.pendingCandidatesCount > 0) {
			return
		}

		this.latestCandidateTimestamp = Math.max(this.latestCandidateTimestamp, timestamp)
		this.quietPeriodAwaiter?.startQuietTimer({
			resourceLoadedTimestamp: this.latestCandidateTimestamp,
		})
	}

	private stopMeasurement(): void {
		this.quietPeriodAwaiter?.removeQuietTimer()
		this.unsubscribeMediaMonitor?.()
		this.activePromiseResolve = undefined
		this.quietPeriodAwaiter = undefined
		this.unsubscribeMediaMonitor = undefined
	}
}
