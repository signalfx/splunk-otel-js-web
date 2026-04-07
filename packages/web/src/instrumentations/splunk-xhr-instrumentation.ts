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

import * as api from '@opentelemetry/api'
import { ROOT_CONTEXT } from '@opentelemetry/api'
import { isTracingSuppressed, suppressTracing } from '@opentelemetry/core'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

import { SessionManager } from '../managers'
import { captureTraceParent } from '../servertiming'
import { SplunkOtelWebConfig, SplunkXhrInstrumentationConfig } from '../types'

type ExposedSuper = {
	_addResourceObserver: (xhr: XMLHttpRequest, spanUrl: string) => void
	_createSpan: (xhr: XMLHttpRequest, url: string, method: string) => api.Span | undefined
}

export class SplunkXhrInstrumentation extends XMLHttpRequestInstrumentation {
	protected otelConfig: SplunkOtelWebConfig

	constructor(
		config: SplunkXhrInstrumentationConfig = {},
		otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
	) {
		super(config)
		this.otelConfig = otelConfig

		const separateTraces = config.separateTraces ?? false

		const _superCreateSpan = (this as unknown as ExposedSuper)._createSpan.bind(this)
		const _superAddResourceObserver = (this as unknown as ExposedSuper)._addResourceObserver.bind(this)

		// Override _createSpan to handle separateTraces (same approach as Fetch)
		;(this as unknown as ExposedSuper)._createSpan = (xhr: XMLHttpRequest, url: string, method: string) => {
			let span: api.Span | undefined

			if (separateTraces) {
				// Capture parent context for link before creating root span
				const activeContext = api.context.active()
				const parentSpan = api.trace.getSpan(activeContext)
				const parentContext = parentSpan?.spanContext()

				// Create hybrid context that preserves suppressTracing from active context
				const hybridContext = isTracingSuppressed(activeContext) ? suppressTracing(ROOT_CONTEXT) : ROOT_CONTEXT

				// Create span in hybrid context to get a new trace ID while preserving suppressTracing
				span = api.context.with(hybridContext, () => _superCreateSpan(xhr, url, method))

				// Add parent span info as attributes
				if (span && parentContext?.traceId) {
					span.setAttributes({
						'link.interaction.spanId': parentContext.spanId,
						'link.interaction.traceId': parentContext.traceId,
					})
				}
			} else {
				span = _superCreateSpan(xhr, url, method)
			}

			if (span) {
				// don't care about success/failure, just want to see response headers if they exist
				xhr.addEventListener('readystatechange', function () {
					if (xhr.readyState === xhr.HEADERS_RECEIVED) {
						const headers = xhr.getAllResponseHeaders().toLowerCase()
						if (headers.includes('server-timing')) {
							const st = xhr.getResponseHeader('server-timing')
							if (st !== null) {
								captureTraceParent(st, span)
							}
						}
					}
				})

				// FIXME long-term answer for deprecating attributes.component?
				// The upstream _createSpan calls tracer.startSpan() internally, which triggers SpanProcessor.onStart
				// before this override has a chance to set the component attribute. SpanEmitterProcessor.onStart
				// relies on component being present to route the event, so 'xml-http-request:start' would never fire.
				// Work around this by setting component first and then emitting the start event manually.
				span.setAttribute('component', this.moduleName)
				this.otelConfig.spanEmitter?.emitSpan(span as unknown as ReadableSpan, 'start')
				// Temporary return to old span name until cleared by backend
				span.updateName(`HTTP ${method.toUpperCase()}`)
			}

			return span
		}
		;(this as unknown as ExposedSuper)._addResourceObserver = (xhr: XMLHttpRequest, spanUrl: string) => {
			// Fix: PerformanceObserver feature detection is broken and crashes in IE
			// Is fixed in 0.29.0 but contrib isn't updated yet
			if (typeof PerformanceObserver !== 'function' || typeof PerformanceResourceTiming !== 'function') {
				return
			}

			_superAddResourceObserver(xhr, spanUrl)
		}
	}
}
