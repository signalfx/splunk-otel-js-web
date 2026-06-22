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

import { parseOtlpPayload } from '@test-kit/common/otel/otlp-types'
import type { ExportedTestSpan } from '@test-kit/common/otel/test-span'

import { SplunkOTLPTraceExporter } from '../../src/exporters/otlp'

export const buildInMemorySplunkExporter = () => {
	const spans: ExportedTestSpan[] = []
	const handleData = (data: unknown) => {
		const text =
			data instanceof Uint8Array ? new TextDecoder().decode(data) : typeof data === 'string' ? data : String(data)
		const newSpans = parseOtlpPayload(text)
		spans.push(...newSpans)
	}
	const exporter = new SplunkOTLPTraceExporter({
		beaconSender: (_url, data) => handleData(data),
		url: '',
		xhrSender: (_url, data) => handleData(data),
	})

	return {
		clearSpans: () => {
			spans.length = 0
		},
		exporter,
		getFinishedSpans: () => spans,
	}
}
