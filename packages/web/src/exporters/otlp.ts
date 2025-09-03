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

import { diag } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

import {
	NATIVE_BEACON_SENDER,
	NATIVE_XHR_SENDER,
	NOOP_ATTRIBUTES_TRANSFORMER,
	type SplunkExporterConfig,
} from './common'

export class SplunkOTLPTraceExporter extends OTLPTraceExporter {
	protected readonly _beaconSender: SplunkExporterConfig['beaconSender'] = NATIVE_BEACON_SENDER

	protected readonly _onAttributesSerializing: SplunkExporterConfig['onAttributesSerializing']

	protected readonly _xhrSender: SplunkExporterConfig['xhrSender'] = NATIVE_XHR_SENDER

	constructor(options: SplunkExporterConfig) {
		super(options)
		this._onAttributesSerializing = options.onAttributesSerializing || NOOP_ATTRIBUTES_TRANSFORMER
	}

	send(items: ReadableSpan[], onSuccess: () => void): void {
		if (this._shutdownOnce.isCalled) {
			diag.debug('Shutdown already started. Cannot send objects')
			return
		}

		const itemsLength = items.length
		items = items.filter((span) => Boolean(span.attributes['splunk.rumSessionId']))

		if (items.length !== itemsLength) {
			diag.debug(
				'Some spans were dropped because they are missing the splunk.rumSessionId attribute. This usually means the session has reached its maximum allowed duration.',
			)
		}

		items = items.map((span) => {
			// @ts-expect-error Yep we're overwriting a readonly property here. Deal with it
			span.attributes = this._onAttributesSerializing
				? this._onAttributesSerializing(span.attributes, span)
				: span.attributes
			return span
		})

		if (items.length === 0) {
			onSuccess()
			return
		}

		// @ts-expect-error Say no to private
		const body = this._serializer.serializeRequest(items) ?? new Uint8Array()

		// Changed: Determine which exporter to use at the time of export
		if (document.hidden && this._beaconSender && body.length <= 64_000) {
			this._beaconSender(this.url, body, { type: 'application/json' })
		} else if (this._xhrSender) {
			this._xhrSender(this.url, body, {
				// These headers may only be necessary for otel's collector,
				// need to test with actual ingest
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				...this.headers,
			})
		}

		onSuccess()
	}
}
