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

import { Attributes } from '@opentelemetry/api'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

export interface SplunkExporterConfig {
	beaconSender?: (url: string, data: string, headers?: Record<string, string>) => void
	onAttributesSerializing?: (attributes: Attributes, span: ReadableSpan) => Attributes
	url: string
	xhrSender?: (url: string, data: string, headers?: Record<string, string>) => void
}

export function NOOP_ATTRIBUTES_TRANSFORMER(attributes: Attributes): Attributes {
	return attributes
}
export function NATIVE_XHR_SENDER(url: string, data: string, headers?: Record<string, string>): void {
	const xhr = new XMLHttpRequest()
	xhr.open('POST', url)
	const defaultHeaders = {
		'Accept': 'application/json',
		'Content-Type': 'application/json',
	}
	Object.entries(Object.assign(Object.assign({}, defaultHeaders), headers)).forEach(([k, v]) => {
		xhr.setRequestHeader(k, v)
	})
	xhr.send(data)
}
export const NATIVE_BEACON_SENDER: SplunkExporterConfig['beaconSender'] =
	typeof navigator !== 'undefined' && navigator.sendBeacon
		? (url: string, data: string, blobPropertyBag?: BlobPropertyBag) => {
				const payload = blobPropertyBag ? new Blob([data], blobPropertyBag) : data
				navigator.sendBeacon(url, payload)
			}
		: undefined
