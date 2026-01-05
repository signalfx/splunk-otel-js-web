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
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

import SplunkRum from '../../src'
import { ZipkinSpan } from '../../src/exporters/zipkin'
import { SESSION_STORAGE_KEY } from '../../src/managers'
import { buildInMemorySplunkExporter } from './memory-exporter'
import { SpanCapturer } from './span-capturer'

export const initWithDefaultConfig = (capturer: SpanCapturer, additionalOptions = {}): void => {
	SplunkRum._internalInit({
		allowInsecureBeacon: true,
		applicationName: 'my-app',
		beaconEndpoint: 'http://127.0.0.1:8888/v1/trace',
		bufferTimeout: 0,
		deploymentEnvironment: 'my-env',
		globalAttributes: { customerType: 'GOLD' },
		rumAccessToken: '123-no-warn-spam-in-console',
		spanProcessors: [capturer],
		version: '1.2-test.3',
		...additionalOptions,
	})

	if (!SplunkRum.inited) {
		throw new Error('SplunkRum not initialized')
	}
}

export function initWithSyncPipeline(additionalOptions = {}): {
	forceFlush: () => Promise<void>
	getFinishedSpans: () => ZipkinSpan[]
} {
	const { exporter, getFinishedSpans } = buildInMemorySplunkExporter()
	const processor = new SimpleSpanProcessor(exporter)

	SplunkRum._internalInit({
		allowInsecureBeacon: true,
		applicationName: 'my-app',
		beaconEndpoint: 'http://127.0.0.1:8888/v1/trace',
		bufferTimeout: 0,
		deploymentEnvironment: 'my-env',
		exporter: { factory: () => exporter },
		rumAccessToken: '123-no-warn-spam-in-console',
		spanProcessor: { factory: () => processor },
		version: '1.2-test.3',
		...additionalOptions,
	})

	return {
		forceFlush: () => processor.forceFlush(),
		getFinishedSpans,
	}
}

export const deinit = (force?: boolean): void => {
	SplunkRum.deinit(force)

	localStorage.removeItem(SESSION_STORAGE_KEY)
	document.cookie = `${SESSION_STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
	// TODO: Migrate anonymous user ID to storage providers
	document.cookie = `_splunk_rum_user_anonymousId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}
