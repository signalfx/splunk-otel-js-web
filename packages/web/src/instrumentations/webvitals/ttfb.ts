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
import type { TTFBMetricWithAttribution } from 'web-vitals/attribution'

import { setNumberAttribute } from './span-attributes'

export function setTTFBAttributionAttributes(span: Span, metric: TTFBMetricWithAttribution): void {
	const { attribution } = metric

	setNumberAttribute(span, 'ttfb.waiting_duration', attribution.waitingDuration)
	setNumberAttribute(span, 'ttfb.cache_duration', attribution.cacheDuration)
	setNumberAttribute(span, 'ttfb.dns_duration', attribution.dnsDuration)
	setNumberAttribute(span, 'ttfb.connection_duration', attribution.connectionDuration)
	setNumberAttribute(span, 'ttfb.request_duration', attribution.requestDuration)
}
