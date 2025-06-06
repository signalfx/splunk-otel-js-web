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

import { Context, Link, Attributes, SpanKind } from '@opentelemetry/api'
import { Sampler, SamplingResult, AlwaysOffSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-web'
import { getOrInitInactiveSession } from './session/session'

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
	protected currentSessionId: string | undefined

	protected currentSessionSampled: boolean | undefined

	protected notSampled: Sampler

	protected ratio: number

	protected sampled: Sampler

	protected upperBound: number

	constructor({
		ratio = 1,
		sampled = new AlwaysOnSampler(),
		notSampled = new AlwaysOffSampler(),
	}: SessionBasedSamplerConfig = {}) {
		this.ratio = this._normalize(ratio)
		this.upperBound = Math.floor(this.ratio * 0xffffffff)

		this.sampled = sampled
		this.notSampled = notSampled
	}

	shouldSample(
		context: Context,
		traceId: string,
		spanName: string,
		spanKind: SpanKind,
		attributes: Attributes,
		links: Link[],
	): SamplingResult {
		// Implementation based on @opentelemetry/core TraceIdRatioBasedSampler
		// but replacing deciding based on traceId with sessionId
		// (not extended from due to private methods)

		// TODO: we are guaranteed to have a session here, so maybe error explicitly if that's not the case?

		const currentSessionId = getOrInitInactiveSession().id
		if (this.currentSessionId !== currentSessionId) {
			this.currentSessionSampled = this._accumulate(currentSessionId) < this.upperBound
			this.currentSessionId = currentSessionId
		}

		const sampler = this.currentSessionSampled ? this.sampled : this.notSampled
		return sampler.shouldSample(context, traceId, spanName, spanKind, attributes, links)
	}

	toString(): string {
		return `SessionBased{ratio=${this.ratio}, sampled=${this.sampled.toString()}, notSampled=${this.notSampled.toString()}}`
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
