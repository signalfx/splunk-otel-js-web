/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { ReadableSpan, SimpleSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import SplunkRum, { SplunkZipkinExporter } from '../src/index'
import { ZipkinSpan } from '../src/exporters/zipkin'
import { assert } from 'chai'

export class SpanCapturer implements SpanProcessor {
	public readonly spans: ReadableSpan[] = []

	clear(): void {
		this.spans.length = 0
	}

	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	onEnd(span: ReadableSpan): void {
		this.spans.push(span)
	}

	onStart(): void {}

	shutdown(): Promise<void> {
		return Promise.resolve()
	}
}

export function buildInMemorySplunkExporter(): {
	exporter: SplunkZipkinExporter
	getFinishedSpans: () => ZipkinSpan[]
} {
	const spans: ZipkinSpan[] = []
	const exporter = new SplunkZipkinExporter({
		url: '',
		beaconSender: null,
		xhrSender: (_, data) => {
			if (typeof data === 'string') {
				const newSpans = JSON.parse(data) as ZipkinSpan[]
				spans.splice(spans.length, 0, ...newSpans)
			}
		},
	})

	return {
		exporter,
		getFinishedSpans: () => spans,
	}
}

export function initWithDefaultConfig(capturer: SpanCapturer, additionalOptions = {}): void {
	SplunkRum._internalInit({
		beaconEndpoint: 'http://127.0.0.1:8888/v1/trace',
		allowInsecureBeacon: true,
		applicationName: 'my-app',
		deploymentEnvironment: 'my-env',
		version: '1.2-test.3',
		globalAttributes: { customerType: 'GOLD' },
		bufferTimeout: 0,
		rumAccessToken: '123-no-warn-spam-in-console',
		...additionalOptions,
	})
	assert.ok(SplunkRum.inited)
	SplunkRum.provider.addSpanProcessor(capturer)
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

export function deinit(force?: boolean): void {
	SplunkRum.deinit(force)
}

export function generateFilePaths(domainCount: number, pathCount: number): string[] {
	const paths: string[] = []
	for (let i = 0; i < domainCount; i++) {
		const domain = `http://domain${i}.com`
		for (let j = 0; j < pathCount; j++) {
			paths.push(`${domain}/path${j}.js`)
		}
	}
	return paths
}

export function generateRandomStackTrace(paths: string[], stackCount: number): string {
	let stack = 'Error\n'
	for (let i = 0; i < stackCount; i++) {
		stack += `at ${paths[Math.floor(Math.random() * paths.length)]}:${Math.floor(Math.random() * 1000)}:${Math.floor(Math.random() * 1000)}\n`
	}
	return stack
}
