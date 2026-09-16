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

import { type Span, SpanStatusCode } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

export function getResourceElementUrl(element: Element): string | undefined {
	const tagName = element.tagName.toUpperCase()
	if (tagName === 'LINK') {
		return element.getAttribute('href') ?? undefined
	}

	if (
		tagName === 'AUDIO' ||
		tagName === 'EMBED' ||
		tagName === 'IFRAME' ||
		tagName === 'IMG' ||
		tagName === 'INPUT' ||
		tagName === 'SCRIPT' ||
		tagName === 'SOURCE' ||
		tagName === 'TRACK' ||
		tagName === 'VIDEO'
	) {
		return element.getAttribute('src') ?? undefined
	}

	if (tagName === 'OBJECT') {
		return element.getAttribute('data') ?? undefined
	}

	return undefined
}

export function isResourceElementLoadError(event: Event): boolean {
	const target = event.target
	return (
		event.type === 'error' &&
		target instanceof Element &&
		target.tagName.toUpperCase() !== 'SCRIPT' &&
		getResourceElementUrl(target) !== undefined
	)
}

export function setResourceTimingStatus(span: Span, resource: PerformanceResourceTiming): void {
	if (typeof resource.responseStatus !== 'number' || resource.responseStatus <= 0) {
		return
	}

	span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, resource.responseStatus)

	if (resource.responseStatus >= 400) {
		span.setStatus({ code: SpanStatusCode.ERROR })
	}
}
