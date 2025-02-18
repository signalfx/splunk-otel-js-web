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

import { FetchInstrumentation, FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch'
import { captureTraceParent } from './servertiming'
import { diag, Span } from '@opentelemetry/api'
import * as core from '@opentelemetry/core'
import { FetchResponse, SpanData } from '@opentelemetry/instrumentation-fetch/build/src/types'

const OBSERVER_WAIT_TIME_MS = 300

type ExposedSuper = {
	_addHeaders: (options: Request | RequestInit, spanUrl: string) => void
}

export class SplunkFetchInstrumentation extends FetchInstrumentation {
	constructor(config: FetchInstrumentationConfig = {}) {
		const origCustomAttrs = config.applyCustomAttributesOnSpan
		config.applyCustomAttributesOnSpan = function (span, request, result) {
			// Temporary return to old span name until cleared by backend

			span.updateName(`HTTP ${(request.method || 'GET').toUpperCase()}`)
			span.setAttribute('component', 'fetch')

			if (span && result instanceof Response && result.headers) {
				const st = result.headers.get('Server-Timing')
				if (st) {
					captureTraceParent(st, span)
				}
			}

			if (origCustomAttrs) {
				origCustomAttrs(span, request, result)
			}
		}

		super(config)

		const parent = this as any

		const createSpanOrig = parent._createSpan.bind(this)
		parent._createSpan = (url, options) => {
			const createdSpan = createSpanOrig(url, options)
			if (createdSpan) {
				createdSpan.setAttribute('debug.browser.visibility_state.start', document.visibilityState)
			}

			return createdSpan
		}

		parent._endSpan = (span: Span, spanData: SpanData, response: FetchResponse) => {
			const endTime = core.millisToHrTime(Date.now())
			const performanceEndTime = core.hrTime()
			parent._addFinalSpanAttributes(span, response)

			setTimeout(() => {
				spanData.observer?.disconnect()
				parent._findResourceAndAddNetworkEvents(span, spanData, performanceEndTime)
				// eslint-disable-next-line no-plusplus
				parent._tasksCount--
				parent._clearResources()
				span.setAttribute('debug.browser.visibility_state.end', document.visibilityState)
				span.end(endTime)
			}, OBSERVER_WAIT_TIME_MS)
		}

		const _superAddHeaders = (this as unknown as ExposedSuper)._addHeaders.bind(this) as ExposedSuper['_addHeaders']
		;(this as unknown as ExposedSuper)._addHeaders = (options, spanUrl) => {
			// Fix: Fetch instrumentation currently can't handle headers array
			try {
				if (options.headers && Array.isArray(options.headers)) {
					;(options as RequestInit).headers = new Headers(options.headers)
				}
			} catch (err) {
				diag.error('Error fixing headers', err)
			}

			return _superAddHeaders(options, spanUrl)
		}
	}

	enable(): void {
		// Don't attempt in browsers where there's no fetch API
		if (!window.fetch) {
			return
		}

		super.enable()
	}
}
