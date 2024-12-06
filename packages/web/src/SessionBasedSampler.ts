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

import { Context, Link, Sampler, SamplingResult, SpanAttributes, SpanKind } from '@opentelemetry/api'
import { AlwaysOffSampler, AlwaysOnSampler } from '@opentelemetry/core'
import { SessionProvider } from './services/session-service'

export interface SessionBasedSamplerConfig {
	/**
	 * Sampler called when session isn't being sampled
	 * default: AlwaysOffSampler
	 */
	notSampled?: Sampler

	/**
	 * Ratio of sessions that get sampled (0.0 - 1.0, where 1 is all sessions)
	 */
	ratio?: number

	/**
	 * Sampler called when session is being sampled
	 * default: AlwaysOnSampler
	 */
	sampled?: Sampler
}

export class SessionBasedSampler implements Sampler {
	protected _currentSession: string

	protected _currentSessionSampled: boolean

	protected _notSampled: Sampler

	protected _ratio: number

	protected _sampled: Sampler

	protected _upperBound: number

	constructor({
		ratio = 1,
		sampled = new AlwaysOnSampler(),
		notSampled = new AlwaysOffSampler(),
	}: SessionBasedSamplerConfig = {}) {
		this._ratio = this._normalize(ratio)
		this._upperBound = Math.floor(this._ratio * 0xffffffff)

		this._sampled = sampled
		this._notSampled = notSampled
	}

	shouldSample(
		context: Context,
		traceId: string,
		spanName: string,
		spanKind: SpanKind,
		attributes: SpanAttributes,
		links: Link[],
	): SamplingResult {
		// Implementation based on @opentelemetry/core TraceIdRatioBasedSampler
		// but replacing deciding based on traceId with sessionId
		// (not extended from due to private methods)
		const currentSession = SessionProvider.sessionId
		if (this._currentSession !== currentSession) {
			this._currentSessionSampled = this._accumulate(currentSession) < this._upperBound
			this._currentSession = currentSession
		}

		const sampler = this._currentSessionSampled ? this._sampled : this._notSampled

		return sampler.shouldSample(context, traceId, spanName, spanKind, attributes, links)
	}

	toString(): string {
		return `SessionBased{ratio=${this._ratio}, sampled=${this._sampled.toString()}, notSampled=${this._notSampled.toString()}}`
	}

	private _accumulate(sessionId: string): number {
		let accumulation = 0
		for (let i = 0; i < sessionId.length / 8; i++) {
			const pos = i * 8
			const part = parseInt(sessionId.slice(pos, pos + 8), 16)
			accumulation = (accumulation ^ part) >>> 0
		}
		return accumulation
	}

	private _normalize(ratio: number): number {
		if (typeof ratio !== 'number' || isNaN(ratio)) {
			return 0
		}

		return ratio >= 1 ? 1 : ratio <= 0 ? 0 : ratio
	}
}
