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

import { Attributes } from '@opentelemetry/api'

export interface SplunkOtelWebEventTypes {
	'global-attributes-changed': {
		attributes: Attributes
	}
	'session-changed': {
		sessionId: string
	}
}

type SplunkEventListener<type extends keyof SplunkOtelWebEventTypes> = (event: {
	payload: SplunkOtelWebEventTypes[type]
}) => void

type AddEventListenerOptions = {
	once?: boolean
}

export class InternalEventTarget {
	protected events: Partial<{
		[T in keyof SplunkOtelWebEventTypes]: { listener: SplunkEventListener<T>; options: AddEventListenerOptions }[]
	}> = {}

	addEventListener<T extends keyof SplunkOtelWebEventTypes>(
		type: T,
		listener: SplunkEventListener<T>,
		options: AddEventListenerOptions = {},
	): void {
		if (!this.events[type]) {
			this.events[type] = []
		}

		this.events[type].push({ listener, options })
	}

	emit<T extends keyof SplunkOtelWebEventTypes>(type: T, payload: SplunkOtelWebEventTypes[T]): void {
		const listeners = this.events[type]
		if (!listeners) {
			return
		}

		listeners.forEach(({ listener, options }) => {
			try {
				// Avoid breaking the agent if the listener throws an error
				listener({ payload })
			} catch (e) {
				console.error('Error in event listener', e)
			}

			if (options.once) {
				this.removeEventListener(type, listener)
			}
		})
	}

	removeEventListener<T extends keyof SplunkOtelWebEventTypes>(
		type: T,
		listenerToRemove: SplunkEventListener<T>,
	): void {
		if (!this.events[type]) {
			return
		}

		for (let i = 0; i < this.events[type].length; i++) {
			const { listener } = this.events[type][i]
			if (listener === listenerToRemove) {
				this.events[type].splice(i, 1)
				break
			}
		}
	}
}

export interface SplunkOtelWebEventTarget {
	/**
	 * @deprecated Use {@link addEventListener}
	 */
	_experimental_addEventListener: InternalEventTarget['addEventListener']

	/**
	 * @deprecated Use {@link removeEventListener}
	 */
	_experimental_removeEventListener: InternalEventTarget['removeEventListener']

	addEventListener: InternalEventTarget['addEventListener']

	removeEventListener: InternalEventTarget['removeEventListener']
}
