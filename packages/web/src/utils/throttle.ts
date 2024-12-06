/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
export function throttle<T extends (...args: unknown[]) => any>(func: T, limit: number) {
	let lastExecutionTime = 0
	let timeout: ReturnType<typeof setTimeout> | null = null
	let visibilityListener: (() => void) | null = null
	let lastArgs: Parameters<T> | undefined

	const executeFunc = (...args: Parameters<T>) => {
		lastExecutionTime = performance.now()
		return func(...args)
	}

	const throttled = (...args: Parameters<T>) => {
		lastArgs = args

		if (visibilityListener) {
			document.removeEventListener('visibilitychange', visibilityListener)
			visibilityListener = null
		}

		const now = performance.now()
		const timeSinceLastExecution = now - lastExecutionTime

		if (timeout) {
			clearTimeout(timeout)
			timeout = null
		}

		if (timeSinceLastExecution >= limit || lastExecutionTime === 0) {
			executeFunc(...args)
		} else {
			timeout = setTimeout(() => {
				executeFunc(...args)
			}, limit - timeSinceLastExecution)

			visibilityListener = () => {
				if (document.visibilityState === 'hidden') {
					if (timeout !== null) {
						clearTimeout(timeout)
					}

					executeFunc(...args)
				}

				document.removeEventListener('visibilitychange', visibilityListener)
			}
		}
	}

	throttled.flush = () => {
		if (timeout) {
			clearTimeout(timeout)
			timeout = null
		}

		if (visibilityListener) {
			document.removeEventListener('visibilitychange', visibilityListener)
			visibilityListener = null
		}

		if (lastArgs) {
			executeFunc(...lastArgs)
		}
	}

	return throttled
}
