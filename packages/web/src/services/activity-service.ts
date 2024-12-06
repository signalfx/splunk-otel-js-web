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
type OnActivityCallback = () => void

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
	'click',
	'scroll',
	'mousedown',
	'keydown',
	'touchend',
	'visibilitychange',
]

export class ActivityService {
	private onActivity?: OnActivityCallback

	start = (onActivity: OnActivityCallback) => {
		this.onActivity = onActivity
		this.attachActivityEventListeners()
	}

	stop = () => {
		this.removeActivityEventListeners()
		this.onActivity = undefined
	}

	private attachActivityEventListeners = () => {
		ACTIVITY_EVENTS.forEach(
			(type) =>
				this.onActivity && document.addEventListener(type, this.onActivity, { capture: true, passive: true }),
		)
	}

	private removeActivityEventListeners = () => {
		ACTIVITY_EVENTS.forEach((type) => this.onActivity && document.removeEventListener(type, this.onActivity))
	}
}
