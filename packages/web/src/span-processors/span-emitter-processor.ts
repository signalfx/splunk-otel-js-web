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

import { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base'

export type SpanEventType = string

type SpanEventListener = (span: ReadableSpan) => void

export class SpanEmitterProcessor implements SpanProcessor {
	private buffer: ReadableSpan[] = []

	private isEnabled = false

	private listeners: Map<SpanEventType, Set<SpanEventListener>> = new Map()

	addEventListener(type: SpanEventType, listener: SpanEventListener): void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set())
		}

		this.listeners.get(type)!.add(listener)
	}

	enable() {
		this.isEnabled = true

		for (const span of this.buffer) {
			this.emitSpan(span, 'end')
		}

		this.buffer = []
	}

	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	onEnd(span: ReadableSpan): void {
		if (!this.isEnabled) {
			this.buffer.push(span)
			return
		}

		this.emitSpan(span, 'end')
	}

	onStart(span: Span): void {
		if (!this.isEnabled) {
			return
		}

		this.emitSpan(span, 'start')
	}

	removeEventListener(type: SpanEventType, listener: SpanEventListener): void {
		this.listeners.get(type)?.delete(listener)
	}

	shutdown(): Promise<void> {
		this.listeners.clear()
		return Promise.resolve()
	}

	private emitSpan(span: ReadableSpan | Span, phase: 'start' | 'end'): void {
		const component = span.attributes['component'] as string | undefined
		if (!component) {
			return
		}

		const eventType = phase === 'start' ? `${component}:start` : component
		const listeners = this.listeners.get(eventType) ?? []
		for (const listener of listeners) {
			try {
				listener(span as unknown as ReadableSpan)
			} catch {
				// Avoid breaking the pipeline if a listener throws
			}
		}
	}
}
