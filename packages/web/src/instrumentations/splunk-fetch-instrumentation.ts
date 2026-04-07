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
import { diag, ROOT_CONTEXT } from '@opentelemetry/api'
import { isTracingSuppressed, suppressTracing } from '@opentelemetry/core'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'

import { SessionManager } from '../managers'
import { captureTraceParent } from '../servertiming'
import { SplunkFetchInstrumentationConfig, SplunkOtelWebConfig } from '../types'

type ExposedSuper = {
	_addHeaders: (options: Request | RequestInit, spanUrl: string) => void
	_createSpan: (url: string, options: Partial<Request | RequestInit>) => api.Span | undefined
}

export class SplunkFetchInstrumentation extends FetchInstrumentation {
	protected otelConfig: SplunkOtelWebConfig

	constructor(
		config: SplunkFetchInstrumentationConfig = {},
		otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
	) {
		const separateTraces = config.separateTraces ?? false

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
		this.otelConfig = otelConfig

		if (separateTraces) {
			// Override _createSpan to create root spans with new trace IDs
			const _superCreateSpan = (this as any as ExposedSuper)._createSpan?.bind(this)
			;(this as any as ExposedSuper)._createSpan = (url, options) => {
				// Capture parent context for link before creating root span
				const activeContext = api.context.active()
				const parentSpan = api.trace.getSpan(activeContext)
				const parentContext = parentSpan?.spanContext()

				// Create hybrid context that preserves suppressTracing from active context
				const hybridContext = isTracingSuppressed(activeContext) ? suppressTracing(ROOT_CONTEXT) : ROOT_CONTEXT

				// Create span in hybrid context to get a new trace ID while preserving suppressTracing
				const span = api.context.with(hybridContext, () => _superCreateSpan(url, options))

				// Add parent span info as attributes
				if (span && parentContext?.traceId) {
					span.setAttributes({
						'link.interaction.spanId': parentContext.spanId,
						'link.interaction.traceId': parentContext.traceId,
					})
				}

				return span
			}
		}

		const _superAddHeaders = (this as unknown as ExposedSuper)._addHeaders.bind(this)
		;(this as unknown as ExposedSuper)._addHeaders = (options, spanUrl) => {
			// Fix: Fetch instrumentation currently can't handle headers array
			try {
				if (options.headers && Array.isArray(options.headers)) {
					;(options as RequestInit).headers = new Headers(options.headers)
				}
			} catch (error) {
				diag.error('Error fixing headers', error)
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
