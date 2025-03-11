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

import { Context, Link, Attributes, SpanKind, context } from '@opentelemetry/api'
import { Sampler, SamplingResult, SamplingDecision } from '@opentelemetry/sdk-trace-web'
import { updateSessionStatus } from './session'
import { SessionBasedSampler } from './SessionBasedSampler'
import { suppressTracing } from '@opentelemetry/core'
import { getOrInitShadowSession, markActivity } from './session/session'

export class SplunkSamplerWrapper implements Sampler {

	constructor(
		private readonly _options: {
			decider: Sampler,
			allSpansAreActivity: boolean
		},
	) { }

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

		// this ensure that samplers which rely on session ID do actually have access to one
		getOrInitShadowSession();
		return this._options.decider.shouldSample(context, traceId, spanName, spanKind, attributes, links);;
	}

	protected _updateSession(potentialSessionId: string | null) {
		if (this._options.allSpansAreActivity) {
			markActivity()
		}

		context.with(suppressTracing(context.active()), () => {
			updateSessionStatus({
				forceStore: false,
			})
		})
	}

	toString(): string {
		return `SplunkSampler{decider=${this._options.decider.toString()}}`
	}
}
