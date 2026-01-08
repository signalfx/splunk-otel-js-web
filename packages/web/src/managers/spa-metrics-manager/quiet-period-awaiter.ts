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

const DEFAULT_QUIET_TIME = 1000

type ResolveValue = { loadTime: number; timestampOfLastLoadedResource: number }

export class QuietPeriodAwaiter {
	readonly promise: Promise<ResolveValue>

	private isResolved = false

	private lastResourceTimestamp: number | undefined

	private quietTime: number

	private startTime: number

	private timeoutId: ReturnType<typeof setTimeout> | undefined

	constructor(quietTime: number = DEFAULT_QUIET_TIME, startTime: number = performance.now()) {
		this.startTime = startTime
		this.quietTime = quietTime
		this.promise = new Promise<ResolveValue>((r) => {
			// @ts-expect-error Readonly property for resolve
			this.resolve = r
		})
	}

	complete({ areResourcesStillLoading }: { areResourcesStillLoading: boolean }): void {
		if (this.isResolved) {
			return
		}

		this.isResolved = true
		clearTimeout(this.timeoutId)

		let endTimestamp = performance.now()
		if (!areResourcesStillLoading && this.lastResourceTimestamp) {
			diag.debug('No resources loading. Using last resource timestamp.')
			endTimestamp = this.lastResourceTimestamp
		}

		const loadTime = endTimestamp - this.startTime
		diag.debug('QuietPeriodAwaiter: Complete', { loadTime })
		this.resolve({
			loadTime,
			timestampOfLastLoadedResource: endTimestamp,
		})
	}

	removeQuietTimer(): void {
		if (this.timeoutId === undefined) {
			return
		}

		clearTimeout(this.timeoutId)
		this.timeoutId = undefined
	}

	startQuietTimer({ resourceLoadedTimestamp }: { resourceLoadedTimestamp: number }): void {
		this.lastResourceTimestamp = resourceLoadedTimestamp
		clearTimeout(this.timeoutId)

		this.timeoutId = setTimeout(() => {
			diag.debug('QuietPeriodAwaiter: Quiet period expired')
			if (!this.isResolved) {
				this.isResolved = true
				this.resolve({
					loadTime: Math.max(resourceLoadedTimestamp - this.startTime, 0),
					timestampOfLastLoadedResource: resourceLoadedTimestamp,
				})
			}
		}, this.quietTime)
	}

	private readonly resolve: (resolveValue: ResolveValue) => void = () => {}
}
