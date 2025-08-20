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
import { Span, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import { forgetAnonymousId, getOrCreateAnonymousId } from './user-tracking'
import { UserTrackingMode } from './types/config'
import { updateSessionStatus } from './session'

export class SplunkSpanAttributesProcessor implements SpanProcessor {
	private readonly globalAttributes: Attributes

	constructor(
		globalAttributes: Attributes,
		private useLocalStorageForSessionMetadata: boolean,
		private getUserTracking: () => UserTrackingMode,
		private domain?: string,
	) {
		this.globalAttributes = globalAttributes ?? {}
	}

	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	getGlobalAttributes(): Attributes {
		return this.globalAttributes
	}

	onEnd(): void {
		// Intentionally empty
	}

	onStart(span: Span): void {
		// now that we have started the span, the session is not inactive anymore
		const sessionState = updateSessionStatus({ forceStore: false, inactive: false })

		span.setAttribute('location.href', location.href)
		span.setAttributes(this.globalAttributes)
		span.setAttribute('splunk.rumSessionId', sessionState.id)

		if (this.getUserTracking() === 'anonymousTracking') {
			span.setAttribute(
				'user.anonymous_id',
				getOrCreateAnonymousId({
					useLocalStorage: this.useLocalStorageForSessionMetadata,
					domain: this.domain,
				}),
			)
		}

		span.setAttribute('browser.instance.visibility_state', document.visibilityState)
	}

	setGlobalAttributes(attributes?: Attributes): void {
		if (attributes) {
			Object.assign(this.globalAttributes, attributes)
		} else {
			for (const key of Object.keys(this.globalAttributes)) {
				delete this.globalAttributes[key]
			}
		}
	}

	shutdown(): Promise<void> {
		forgetAnonymousId()
		return Promise.resolve()
	}
}
