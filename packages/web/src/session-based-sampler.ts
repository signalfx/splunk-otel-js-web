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

import { Attributes, Context, Link, SpanKind } from '@opentelemetry/api'
import { AlwaysOffSampler, AlwaysOnSampler, Sampler, SamplingResult } from '@opentelemetry/sdk-trace-web'

import { getGlobal } from './global-utils'
import { SplunkOtelWebType } from './index'

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
		notSampled = new AlwaysOffSampler(),
		ratio = 1,
		sampled = new AlwaysOnSampler(),
	}: SessionBasedSamplerConfig = {}) {
		this.ratio = this._normalize(ratio)
		// eslint-disable-next-line unicorn/number-literal-case
		this.upperBound = Math.floor(this.ratio * 0xff_ff_ff_ff)

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

		const SplunkRum = getGlobal() as SplunkOtelWebType
		if (!SplunkRum.sessionManager) {
			throw new Error('SplunkRum is not initialized')
		}

		const currentSessionId = SplunkRum.sessionManager.getSessionId()

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
			const part = Number.parseInt(sessionId.slice(pos, pos + 8), 16)
			accumulation = (accumulation ^ part) >>> 0
		}
		return accumulation
	}

	private _normalize(ratio: number): number {
		if (typeof ratio !== 'number' || Number.isNaN(ratio)) {
			return 0
		}

		return ratio >= 1 ? 1 : Math.max(ratio, 0)
	}
}
