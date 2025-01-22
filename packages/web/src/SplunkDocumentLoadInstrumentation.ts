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

import { InstrumentationConfig } from '@opentelemetry/instrumentation'
import { AttributeNames, DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import * as api from '@opentelemetry/api'
import { captureTraceParentFromPerformanceEntries } from './servertiming'
import { PerformanceEntries } from '@opentelemetry/sdk-trace-web'
import { Span } from '@opentelemetry/sdk-trace-base'
import { isUrlIgnored } from '@opentelemetry/core'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

export interface SplunkDocLoadInstrumentationConfig extends InstrumentationConfig {
	ignoreUrls?: (string | RegExp)[]
}

const excludedInitiatorTypes = ['beacon', 'fetch', 'xmlhttprequest']

function addExtraDocLoadTags(span: api.Span) {
	if (document.referrer && document.referrer !== '') {
		span.setAttribute('document.referrer', document.referrer)
	}

	if (window.screen) {
		span.setAttribute('screen.xy', window.screen.width + 'x' + window.screen.height)
	}
}

type PerformanceEntriesWithServerTiming = PerformanceEntries & {
	serverTiming?: ReadonlyArray<{ description: string; duration: number; name: string }>
}

type ExposedSuper = {
	_endSpan(span: api.Span | undefined, performanceName: string, entries: PerformanceEntries): void
	_initResourceSpan(resource: PerformanceResourceTiming, parentSpan: api.Span): void
}

export class SplunkDocumentLoadInstrumentation extends DocumentLoadInstrumentation {
	constructor(config: SplunkDocLoadInstrumentationConfig = {}) {
		super(config)

		const exposedSuper = this as any as ExposedSuper

		const _superEndSpan: ExposedSuper['_endSpan'] = exposedSuper._endSpan.bind(this)
		exposedSuper._endSpan = (span, performanceName, entries) => {
			// TODO: upstream exposed name on api.Span, then fix
			const exposedSpan = span as any as Span

			if (span) {
				span.setAttribute('component', this.component)
			}

			if (span && exposedSpan.name !== AttributeNames.DOCUMENT_LOAD) {
				// only apply links to document/resource fetch
				// To maintain compatibility, getEntries copies out select items from
				// different versions of the performance API into its own structure for the
				// initial document load (but leaves the entries undisturbed for resource loads).
				if (exposedSpan.name === AttributeNames.DOCUMENT_FETCH && performance.getEntriesByType) {
					const navEntries = performance.getEntriesByType('navigation')
					if (!(entries as PerformanceEntriesWithServerTiming).serverTiming && navEntries[0]?.serverTiming) {
						;(entries as PerformanceEntriesWithServerTiming).serverTiming = navEntries[0].serverTiming
					}

					if (navEntries[0]?.responseStatus) {
						span.setAttribute('http.response.status_code', navEntries[0].responseStatus)
					}
				}

				captureTraceParentFromPerformanceEntries(entries, span)
				span.setAttribute(SemanticAttributes.HTTP_METHOD, 'GET')
			}

			if (span && exposedSpan.name === AttributeNames.DOCUMENT_LOAD) {
				addExtraDocLoadTags(span)
			}

			return _superEndSpan(span, performanceName, entries)
		}

		const _superInitResourceSpan: ExposedSuper['_initResourceSpan'] = exposedSuper._initResourceSpan.bind(this)
		exposedSuper._initResourceSpan = (resource, parentSpan) => {
			if (
				excludedInitiatorTypes.indexOf(resource.initiatorType) !== -1 ||
				isUrlIgnored(resource.name, config.ignoreUrls)
			) {
				return
			}

			_superInitResourceSpan(resource, parentSpan)
		}
	}
}
