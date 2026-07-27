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
import { addHrTimes, hrTimeToMilliseconds, isUrlIgnored, millisToHrTime, timeInputToHrTime } from '@opentelemetry/core'
import { InstrumentationConfig } from '@opentelemetry/instrumentation'
import {
	AttributeNames,
	DocumentLoadInstrumentation,
	DocumentLoadInstrumentationConfig,
	ResourceFetchCustomAttributeFunction,
} from '@opentelemetry/instrumentation-document-load'
import { Span } from '@opentelemetry/sdk-trace-base'
import { addSpanNetworkEvents, PerformanceEntries, PerformanceTimingNames as PTN } from '@opentelemetry/sdk-trace-web'
import { SemanticAttributes, SEMATTRS_HTTP_URL } from '@opentelemetry/semantic-conventions'

import { SessionManager, SpaMetricsManager } from '../managers'
import { setBrowserNavigationPageAttributes } from '../managers/spa-metrics-manager/navigation-relevance'
import { getPctMonitorTypes } from '../managers/spa-metrics-manager/resource-monitor-types'
import { captureTraceParentFromPerformanceEntries } from '../servertiming'
import { SplunkOtelWebConfig } from '../types'
import { isCacheHit } from '../utils/cache'

export interface SplunkDocLoadInstrumentationConfig extends InstrumentationConfig {
	ignoreUrls?: (string | RegExp)[]
}

const excludedInitiatorTypes = new Set(['beacon', 'fetch', 'xmlhttprequest'])
const PAGE_LOAD_SPAN_NAME = 'pageLoad'

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
	_addCustomAttributesOnResourceSpan(
		span: Span,
		resource: PerformanceResourceTiming,
		applyCustomAttributesOnSpan: ResourceFetchCustomAttributeFunction | undefined,
	): void
	_collectPerformance(): void
	_endSpan(span: api.Span | undefined, performanceName: string, entries: PerformanceEntries): void
	_initResourceSpan(resource: PerformanceResourceTiming, parentSpan: api.Span): void
	_onDocumentLoaded(event: Event): void
	_startSpan(
		spanName: string,
		performanceName: string,
		entries: PerformanceEntries,
		parentSpan?: api.Span,
	): Span | undefined
	getConfig(): DocumentLoadInstrumentationConfig
}

export class SplunkDocumentLoadInstrumentation extends DocumentLoadInstrumentation {
	private readonly documentLoadMetricsPromise: ReturnType<SpaMetricsManager['waitForPageLoad']> | undefined

	private navigationStartTimeMillis: number | undefined

	private pageLoadSpan: api.Span | undefined

	private readonly spaMetricsManager: SpaMetricsManager | undefined

	constructor(
		config: SplunkDocLoadInstrumentationConfig = {},
		protected otelConfig: SplunkOtelWebConfig,
		public sessionManager?: SessionManager,
		spaMetricsManager?: SpaMetricsManager,
	) {
		super(config)
		this.spaMetricsManager = spaMetricsManager
		this.documentLoadMetricsPromise = this.spaMetricsManager?.waitForPageLoad({
			startTime: 0,
		})

		const exposedSuper = this as any as ExposedSuper

		const _superStartSpan: ExposedSuper['_startSpan'] = exposedSuper._startSpan.bind(this)
		const _superEndSpan: ExposedSuper['_endSpan'] = exposedSuper._endSpan.bind(this)

		exposedSuper._startSpan = (spanName, performanceName, entries, parentSpan) => {
			const fetchStart = entries[PTN.FETCH_START]

			if (spanName === AttributeNames.DOCUMENT_LOAD && typeof fetchStart === 'number') {
				// Convert the relative Performance API timestamp once. Passing the same
				// absolute timestamp to all three startSpan calls avoids the SDK computing
				// a slightly different performance-to-epoch offset for each span.
				this.navigationStartTimeMillis = hrTimeToMilliseconds(timeInputToHrTime(fetchStart))

				if (this.documentLoadMetricsPromise) {
					this.pageLoadSpan = this.tracer.startSpan(PAGE_LOAD_SPAN_NAME, {
						startTime: this.navigationStartTimeMillis,
					})
					this.pageLoadSpan.setAttribute('component', this.component)
					this.pageLoadSpan.setAttribute(SEMATTRS_HTTP_URL, location.href)
					this.pageLoadSpan.setAttribute(SemanticAttributes.HTTP_USER_AGENT, navigator.userAgent)
				}
			}

			const isNavigationSpan =
				spanName === AttributeNames.DOCUMENT_LOAD || spanName === AttributeNames.DOCUMENT_FETCH
			const startEntries =
				isNavigationSpan && this.navigationStartTimeMillis !== undefined
					? { ...entries, [PTN.FETCH_START]: this.navigationStartTimeMillis }
					: entries
			const span = _superStartSpan(spanName, performanceName, startEntries, parentSpan)

			if (span && spanName === AttributeNames.DOCUMENT_LOAD) {
				span.setAttribute('component', this.component)
				addExtraDocLoadTags(span)
				this.spaMetricsManager?.setCurrentNavigationSpan(span, 0)
				// The span processor's automatic onStart event already ran before
				// `component` was set, so emit manually now that SpanEmitter can
				// route this as `document-load:start`.
				this.otelConfig.spanEmitter?.emitSpan(span, 'start')
			}

			return span
		}

		exposedSuper._onDocumentLoaded = (event?: Event) => {
			if (event && !event.isTrusted) {
				// React only to browser triggered load event
				return
			}

			// Timeout is needed as load event doesn't have yet the performance metrics for loadEnd.
			// Support for event "loadend" is very limited and cannot be used
			window.setTimeout(() => {
				exposedSuper._collectPerformance()
			})
		}

		exposedSuper._endSpan = (span, performanceName, entries) => {
			// TODO: upstream exposed name on api.Span, then fix
			const exposedSpan = span as any as Span

			if (span) {
				span.setAttribute('component', this.component)
			}

			if (span && exposedSpan.name !== AttributeNames.DOCUMENT_LOAD) {
				const isResourceFetch = exposedSpan.name === AttributeNames.RESOURCE_FETCH
				const fetchStart = (entries as unknown as Record<string, unknown>)[PTN.FETCH_START]

				if (typeof fetchStart === 'number') {
					// Firefox can report a cached document fetch slightly before performance.timeOrigin.
					// The initial navigation begins at 0 in the manager's relative time coordinate, so
					// normalize only documentFetch to that boundary. Resource fetches keep their exact
					// start time so overlapping navigations continue to resolve correctly.
					const navigationStartTime = isResourceFetch ? fetchStart : Math.max(fetchStart, 0)
					setBrowserNavigationPageAttributes(
						span,
						this.spaMetricsManager,
						navigationStartTime,
						isResourceFetch
							? {
									monitorTypes: getPctMonitorTypes(
										(entries as unknown as PerformanceResourceTiming).initiatorType,
									),
									type: 'resource',
									url: (entries as unknown as PerformanceResourceTiming).name,
								}
							: { type: 'document' },
					)
				}

				// only apply links to document/resource fetch
				// To maintain compatibility, getEntries copies out select items from
				// different versions of the performance API into its own structure for the
				// initial document load (but leaves the entries undisturbed for resource loads).
				if (exposedSpan.name === AttributeNames.DOCUMENT_FETCH && performance.getEntriesByType) {
					const navEntries = performance.getEntriesByType('navigation')
					if (!(entries as PerformanceEntriesWithServerTiming).serverTiming && navEntries[0]?.serverTiming) {
						;(entries as PerformanceEntriesWithServerTiming).serverTiming = navEntries[0].serverTiming
					}

					if (
						navEntries[0] &&
						typeof navEntries[0].responseStatus === 'number' &&
						navEntries[0].responseStatus > 0
					) {
						span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, navEntries[0].responseStatus)
					}
				}

				captureTraceParentFromPerformanceEntries(entries, span)
				span.setAttribute(SemanticAttributes.HTTP_METHOD, 'GET')
			}

			if (span && exposedSpan.name === AttributeNames.DOCUMENT_LOAD) {
				addExtraDocLoadTags(span)

				if (this.documentLoadMetricsPromise) {
					void this.documentLoadMetricsPromise
						.then((pageLoadMetrics) => {
							this.spaMetricsManager?.setPageLoadMetricAttributes(span, pageLoadMetrics)
							this.spaMetricsManager?.completeCurrentNavigationPct(span, pageLoadMetrics.pct)
							if (this.pageLoadSpan && this.navigationStartTimeMillis !== undefined) {
								this.spaMetricsManager?.setPageLoadMetricAttributes(this.pageLoadSpan, pageLoadMetrics)
								const pageLoadSpan = this.pageLoadSpan as Span
								pageLoadSpan.end(
									addHrTimes(pageLoadSpan.startTime, millisToHrTime(pageLoadMetrics.pct)),
								)
								this.navigationStartTimeMillis = undefined
								this.pageLoadSpan = undefined
							}

							api.diag.debug('Sending documentLoad span with PCT result', pageLoadMetrics)
							_superEndSpan(span, performanceName, entries)
						})
						.catch((error) => {
							this.spaMetricsManager?.completeCurrentNavigationPct(span)
							api.diag.warn('SplunkDocumentLoadInstrumentation: Failed to resolve page load metrics.', {
								error,
							})
							if (this.pageLoadSpan) {
								_superEndSpan(this.pageLoadSpan, performanceName, entries)
								this.navigationStartTimeMillis = undefined
								this.pageLoadSpan = undefined
							}

							_superEndSpan(span, performanceName, entries)
						})

					return
				}
			}

			const result = _superEndSpan(span, performanceName, entries)

			return result
		}

		exposedSuper._initResourceSpan = (resource, parentSpan) => {
			if (excludedInitiatorTypes.has(resource.initiatorType) || isUrlIgnored(resource.name, config.ignoreUrls)) {
				return
			}

			const span = exposedSuper._startSpan(AttributeNames.RESOURCE_FETCH, PTN.FETCH_START, resource, parentSpan)
			if (span) {
				span.setAttribute(SEMATTRS_HTTP_URL, resource.name)
				const cacheHitResult = isCacheHit(resource)
				if (cacheHitResult !== undefined) {
					span.setAttribute('http.cache.hit', cacheHitResult)
				}

				if (!exposedSuper.getConfig().ignoreNetworkEvents) {
					addSpanNetworkEvents(span, resource)
					if (typeof resource.responseStatus === 'number' && resource.responseStatus > 0) {
						span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, resource.responseStatus)
					}
				}

				exposedSuper._addCustomAttributesOnResourceSpan(
					span,
					resource,
					exposedSuper.getConfig().applyCustomAttributesOnSpan?.resourceFetch,
				)
				exposedSuper._endSpan(span, PTN.RESPONSE_END, resource)
			}
		}
	}
}
