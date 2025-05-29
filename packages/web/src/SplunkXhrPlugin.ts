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

import {
	XMLHttpRequestInstrumentation,
	XMLHttpRequestInstrumentationConfig,
} from '@opentelemetry/instrumentation-xml-http-request'
import { captureTraceParent } from './servertiming'
import * as api from '@opentelemetry/api'

type ExposedSuper = {
	_addResourceObserver: (xhr: XMLHttpRequest, spanUrl: string) => void
	_createSpan: (xhr: XMLHttpRequest, url: string, method: string) => api.Span | undefined
}

export class SplunkXhrPlugin extends XMLHttpRequestInstrumentation {
	constructor(config: XMLHttpRequestInstrumentationConfig = {}) {
		super(config)

		// TODO: fix when upstream exposes this method
		const _superCreateSpan = (this as any as ExposedSuper)._createSpan.bind(this)
		;(this as any as ExposedSuper)._createSpan = (xhr, url, method) => {
			const span = _superCreateSpan(xhr, url, method)

			if (span) {
				// don't care about success/failure, just want to see response headers if they exist
				xhr.addEventListener('readystatechange', function () {
					if (xhr.readyState === xhr.HEADERS_RECEIVED) {
						const headers = xhr.getAllResponseHeaders().toLowerCase()
						if (headers.indexOf('server-timing') !== -1) {
							const st = xhr.getResponseHeader('server-timing')
							if (st !== null) {
								captureTraceParent(st, span)
							}
						}
					}
				})
				// FIXME long-term answer for deprecating attributes.component?
				span.setAttribute('component', this.moduleName)
				// Temporary return to old span name until cleared by backend
				span.updateName(`HTTP ${method.toUpperCase()}`)
			}

			return span
		}

		const _superAddResourceObserver = (this as unknown as ExposedSuper)._addResourceObserver.bind(this)
		;(this as any as ExposedSuper)._addResourceObserver = (xhr: XMLHttpRequest, spanUrl: string) => {
			// Fix: PerformanceObserver feature detection is broken and crashes in IE
			// Is fixed in 0.29.0 but contrib isn't updated yet
			if (typeof PerformanceObserver !== 'function' || typeof PerformanceResourceTiming !== 'function') {
				return
			}

			_superAddResourceObserver(xhr, spanUrl)
		}
	}
}
