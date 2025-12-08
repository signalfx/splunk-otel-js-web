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

const QUIET_PERIOD = 5000

export class CollectPromise {
	readonly promise: Promise<number>

	private isResolved = false

	private readonly resolve: (loadTime: number) => void

	private startTime = performance.now()

	private timeoutId: ReturnType<typeof setTimeout> | undefined

	constructor() {
		this.resolve = () => {}

		this.promise = new Promise<number>((r) => {
			// @ts-expect-error Readonly property for resolve
			this.resolve = r
		})
	}

	complete(): void {
		if (this.isResolved) {
			return
		}

		this.isResolved = true
		clearTimeout(this.timeoutId)
		this.resolve(performance.now() - this.startTime)
	}

	removeQuitTimer(): void {
		if (this.timeoutId === undefined) {
			return
		}

		clearTimeout(this.timeoutId)
		this.timeoutId = undefined
	}

	startQuitTimer(): void {
		clearTimeout(this.timeoutId)

		const now = performance.now()
		this.timeoutId = setTimeout(() => {
			if (!this.isResolved) {
				this.isResolved = true
				this.resolve(now - this.startTime)
			}
		}, QUIET_PERIOD)
	}
}
