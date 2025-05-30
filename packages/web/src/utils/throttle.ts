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
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number) {
	let lastExecutionTime = 0
	let timeout: ReturnType<typeof setTimeout> | null = null
	let visibilityListener: (() => void) | null = null
	let lastArgs: Parameters<T> | undefined

	const executeFunc = (...args: Parameters<T>) => {
		lastExecutionTime = performance.now()

		try {
			func(...args)
		} finally {
			lastArgs = undefined
		}
	}

	const removeVisibilityListener = () => {
		if (visibilityListener) {
			document.removeEventListener('visibilitychange', visibilityListener, { capture: true })
			visibilityListener = null
		}
	}

	const attachVisibilityListener = (...args: Parameters<T>) => {
		if (visibilityListener) {
			// Remove the previous listener. This is to ensure that we don't have multiple listeners attached.
			document.removeEventListener('visibilitychange', visibilityListener, { capture: true })
		}

		visibilityListener = () => {
			if (document.visibilityState === 'hidden') {
				try {
					executeFunc(...args)
				} finally {
					removeTimeout()
					removeVisibilityListener()
				}
			}
		}

		document.addEventListener('visibilitychange', visibilityListener, { capture: true })
	}

	const removeTimeout = () => {
		if (timeout !== null) {
			clearTimeout(timeout)
			timeout = null
		}
	}

	const attachTimeout = (...args: Parameters<T>) => {
		if (timeout !== null) {
			// Remove the previous listener. This is to ensure that we don't have multiple listeners attached
			removeTimeout()
		}

		timeout = setTimeout(
			() => {
				try {
					executeFunc(...args)
				} finally {
					removeVisibilityListener()
					removeTimeout()
				}
			},
			limit - (performance.now() - lastExecutionTime),
		)
	}

	const throttled = (...args: Parameters<T>) => {
		lastArgs = args

		removeVisibilityListener()
		removeTimeout()

		const now = performance.now()
		const elapsedTimeSinceLastExecution = now - lastExecutionTime

		if (elapsedTimeSinceLastExecution >= limit || lastExecutionTime === 0) {
			executeFunc(...args)
		} else {
			attachTimeout(...args)
			attachVisibilityListener(...args)
		}
	}

	throttled.flush = () => {
		try {
			if (lastArgs) {
				executeFunc(...lastArgs)
			}
		} finally {
			removeVisibilityListener()
			removeTimeout()
		}
	}

	return throttled
}
