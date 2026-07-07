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

import type { Span, SpanProcessor } from '@opentelemetry/sdk-trace-base'

import type { SpaMetricsManager } from '../managers/spa-metrics-manager/spa-metrics-manager'

import { BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE } from '../managers/spa-metrics-manager/constants'

const DOCUMENT_LOAD_COMPONENT = 'document-load'
const DOCUMENT_LOAD_RELEVANT_SPAN_NAMES = new Set(['documentFetch', 'resourceFetch'])
const PCT_RELEVANT_COMPONENTS = new Set([
	'fetch',
	'splunk-loaf',
	'splunk-longtask',
	'splunk-post-doc-load-resource',
	'xml-http-request',
])

function isPctRelevantSpan(span: Span): boolean {
	const component = span.attributes.component
	if (typeof component !== 'string') {
		return false
	}

	return (
		PCT_RELEVANT_COMPONENTS.has(component) ||
		(component === DOCUMENT_LOAD_COMPONENT && DOCUMENT_LOAD_RELEVANT_SPAN_NAMES.has(span.name))
	)
}

export class PctRelevantSpanProcessor implements SpanProcessor {
	constructor(private readonly spaMetricsManager: SpaMetricsManager) {}

	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	onEnd(): void {}

	onStart(span: Span): void {
		const navigationSpanId = this.spaMetricsManager.getCurrentNavigationSpanId()
		if (!navigationSpanId) {
			return
		}

		const originalEnd = span.end.bind(span)
		span.end = (endTime) => {
			if (this.spaMetricsManager.getCurrentNavigationSpanId() === navigationSpanId && isPctRelevantSpan(span)) {
				span.setAttribute(BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE, navigationSpanId)
			}

			originalEnd(endTime)
		}
	}

	shutdown(): Promise<void> {
		return Promise.resolve()
	}
}
