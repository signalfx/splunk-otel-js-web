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

import { Span } from '@opentelemetry/api'
import { parseTraceParent } from '@opentelemetry/core'
import { PerformanceEntries } from '@opentelemetry/sdk-trace-web'

function addTraceParentToSpan(traceParent: string, span: Span): void {
	const spanContext = parseTraceParent(traceParent)

	if (spanContext) {
		span.setAttribute('link.traceId', spanContext.traceId)
		span.setAttribute('link.spanId', spanContext.spanId)
	}
}

const HeaderRegex = /traceparent;desc=(['"])([^'"]+)\1/

export function captureTraceParent(serverTimingValues: string, span: Span): void {
	// getResponseHeader returns multiple Server-Timing headers concat with ', ' (note space)
	// fetch returns concat with ','.
	// split the difference
	for (let header of serverTimingValues.split(',')) {
		header = header.trim()
		const match = header.match(HeaderRegex)
		if (match?.[2]) {
			addTraceParentToSpan(match[2], span)
		}
	}
}

// TODO: fix types for ServerTiming from Performance
export function captureTraceParentFromPerformanceEntries(entries: PerformanceEntries, span: Span): void {
	if (!(entries as any).serverTiming) {
		return
	}

	for (const st of (entries as any).serverTiming) {
		if (st.name === 'traceparent' && st.description) {
			addTraceParentToSpan(st.description, span)
		}
	}
}
