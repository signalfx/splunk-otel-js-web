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

import { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base'

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
