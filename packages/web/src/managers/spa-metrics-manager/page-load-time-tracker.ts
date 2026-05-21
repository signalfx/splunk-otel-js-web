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

import { ResourceState, ResourceStateEvent } from './monitors'
import { QuietPeriodAwaiter } from './quiet-period-awaiter'

export type PageLoadTimeResult = {
	pct: number
	timestampOfLastLoadedResource: number
}

export interface PageLoadTimeTrackerConfig {
	maxResourcesToWatch: number
	quietTime: number
}

export class PageLoadTimeTracker {
	readonly loadingUrls = new Map<string, number>()

	private readonly maxResourcesToWatch: number

	private quietPeriodAwaiter: QuietPeriodAwaiter | undefined

	private readonly quietTime: number

	get loadingResourcesCount(): number {
		let count = 0
		for (const value of this.loadingUrls.values()) {
			count += value
		}
		return count
	}

	constructor(config: PageLoadTimeTrackerConfig) {
		this.maxResourcesToWatch = config.maxResourcesToWatch
		this.quietTime = config.quietTime
	}

	complete(): void {
		this.quietPeriodAwaiter?.complete({ areResourcesStillLoading: this.loadingResourcesCount > 0 })
		this.quietPeriodAwaiter = undefined
	}

	onResourceStateChange = (event: ResourceStateEvent): void => {
		if (event.state === ResourceState.DISCOVERED) {
			if (this.loadingResourcesCount >= this.maxResourcesToWatch) {
				diag.debug('PageLoadTimeTracker: Max resources limit reached, ignoring new resource', event.url)
				return
			}

			const count = this.loadingUrls.get(event.url) ?? 0
			this.loadingUrls.set(event.url, count + 1)
			diag.debug('PageLoadTimeTracker: Detected resource. Resetting quiet timer', event.url)
			this.quietPeriodAwaiter?.removeQuietTimer()
		} else {
			const count = this.loadingUrls.get(event.url) ?? 0
			if (count > 0) {
				if (count === 1) {
					this.loadingUrls.delete(event.url)
				} else {
					this.loadingUrls.set(event.url, count - 1)
				}

				if (this.loadingResourcesCount === 0) {
					diag.debug('PageLoadTimeTracker: No loading resources. Starting quiet timer.')
					this.quietPeriodAwaiter?.startQuietTimer({ resourceLoadedTimestamp: event.timestamp })
				}
			}
		}
	}

	start({ startTime }: { startTime: number }): Promise<PageLoadTimeResult> {
		this.complete()
		this.quietPeriodAwaiter = new QuietPeriodAwaiter(this.quietTime, startTime)

		if (this.loadingResourcesCount === 0) {
			this.quietPeriodAwaiter.startQuietTimer({ resourceLoadedTimestamp: startTime })
			diag.debug('PageLoadTimeTracker: No loading resources. Starting quiet timer.')
		}

		return this.quietPeriodAwaiter.promise.then(({ loadTime: pct, timestampOfLastLoadedResource }) => ({
			pct,
			timestampOfLastLoadedResource,
		}))
	}

	stop(): void {
		this.complete()
		this.loadingUrls.clear()
	}
}
