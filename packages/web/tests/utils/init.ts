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
import SplunkRum from '../../src'
import { SpanCapturer } from './span-capturer'
import { ZipkinSpan } from '../../src/exporters/zipkin'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { buildInMemorySplunkExporter } from './memory-exporter'
import { getNullableStore } from '../../src/session'

export const initWithDefaultConfig = (capturer: SpanCapturer, additionalOptions = {}): void => {
	SplunkRum._internalInit({
		beaconEndpoint: 'http://127.0.0.1:8888/v1/trace',
		allowInsecureBeacon: true,
		applicationName: 'my-app',
		deploymentEnvironment: 'my-env',
		version: '1.2-test.3',
		globalAttributes: { customerType: 'GOLD' },
		bufferTimeout: 0,
		rumAccessToken: '123-no-warn-spam-in-console',
		spanProcessors: [capturer],
		...additionalOptions,
	})

	if (!SplunkRum.inited) {
		throw Error('SplunkRum not initialized')
	}
}

export function initWithSyncPipeline(additionalOptions = {}): {
	forceFlush: () => Promise<void>
	getFinishedSpans: () => ZipkinSpan[]
} {
	const { exporter, getFinishedSpans } = buildInMemorySplunkExporter()
	const processor = new SimpleSpanProcessor(exporter)

	SplunkRum._internalInit({
		beaconEndpoint: 'http://127.0.0.1:8888/v1/trace',
		allowInsecureBeacon: true,
		applicationName: 'my-app',
		deploymentEnvironment: 'my-env',
		version: '1.2-test.3',
		bufferTimeout: 0,
		rumAccessToken: '123-no-warn-spam-in-console',
		exporter: { factory: () => exporter },
		spanProcessor: { factory: () => processor },
		...additionalOptions,
	})

	return {
		forceFlush: () => processor.forceFlush(),
		getFinishedSpans,
	}
}

export const deinit = (force?: boolean): void => {
	getNullableStore()?.remove()
	getNullableStore()?.flush()
	SplunkRum.deinit(force)
}
