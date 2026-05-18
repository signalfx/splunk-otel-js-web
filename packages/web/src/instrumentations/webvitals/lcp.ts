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
import type { LCPMetricWithAttribution } from 'web-vitals/attribution'

import { isFiniteNumber } from '../../types'
import { getResolvedWebVitalsAttributionConfig } from './attribution-config'
import { setAttributes, setNumberAttribute, setStringAttribute } from './span-attributes'
import { WebVitalsAttributionConfig, WebVitalsAttributionOptions } from './types'

type ResourceTimingWithResponseStatus = PerformanceResourceTiming & {
	responseStatus?: number
}

export function sanitizeLCPUrl(url?: string): string | undefined {
	if (!url) {
		return undefined
	}

	try {
		const parsedUrl = new URL(url, window.location.href)
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			return undefined
		}

		return `${parsedUrl.origin}${parsedUrl.pathname}`
	} catch {
		return undefined
	}
}

export function getLCPUrlForAttribution(
	url: string | undefined,
	config?: WebVitalsAttributionConfig,
): string | undefined {
	const urlMode = getResolvedWebVitalsAttributionConfig(config).lcpUrl
	switch (urlMode) {
		case 'off': {
			return undefined
		}
		case 'raw': {
			return url
		}
		case 'sanitized': {
			return sanitizeLCPUrl(url)
		}
		default: {
			const _exhaustiveCheck: never = urlMode
			void _exhaustiveCheck
			return sanitizeLCPUrl(url)
		}
	}
}

export function getLCPResourceTimingAttributes(entry: PerformanceResourceTiming): Record<string, number | string> {
	const attributes: Record<string, number | string> = {}
	const resourceEntry = entry as ResourceTimingWithResponseStatus

	setFiniteAttribute(attributes, 'lcp.resource.transfer_size', resourceEntry.transferSize)
	setFiniteAttribute(attributes, 'http.response.body.size', resourceEntry.encodedBodySize)
	setFiniteAttribute(attributes, 'http.response.body.uncompressed_size', resourceEntry.decodedBodySize)
	setFiniteAttribute(attributes, 'http.response.status_code', resourceEntry.responseStatus)
	setStringRecordAttribute(attributes, 'network.protocol.name', resourceEntry.nextHopProtocol)
	setStringRecordAttribute(attributes, 'lcp.resource.initiator_type', resourceEntry.initiatorType)

	return attributes
}

export function setLCPAttributionAttributes(
	span: Span,
	metric: LCPMetricWithAttribution,
	options: WebVitalsAttributionOptions,
): void {
	const { attribution } = metric

	setStringAttribute(span, 'lcp.target', options.getTarget(attribution.target))

	setStringAttribute(span, 'lcp.url', options.getLCPUrl(attribution.url))
	setNumberAttribute(span, 'lcp.time_to_first_byte', attribution.timeToFirstByte)
	setNumberAttribute(span, 'lcp.resource_load_delay', attribution.resourceLoadDelay)
	setNumberAttribute(span, 'lcp.resource_load_duration', attribution.resourceLoadDuration)
	setNumberAttribute(span, 'lcp.element_render_delay', attribution.elementRenderDelay)

	if (attribution.lcpResourceEntry) {
		setAttributes(span, getLCPResourceTimingAttributes(attribution.lcpResourceEntry))
	}
}

function setFiniteAttribute(
	attributes: Record<string, number | string>,
	name: string,
	value: number | undefined,
): void {
	if (isFiniteNumber(value)) {
		attributes[name] = value
	}
}

function setStringRecordAttribute(
	attributes: Record<string, number | string>,
	name: string,
	value: string | undefined,
): void {
	if (typeof value === 'string' && value.length > 0) {
		attributes[name] = value
	}
}
