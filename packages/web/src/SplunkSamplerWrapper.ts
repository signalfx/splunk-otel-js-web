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
import { Sampler, SamplingResult } from '@opentelemetry/sdk-trace-web'

export class SplunkSamplerWrapper implements Sampler {
	constructor(
		private readonly options: {
			decider: Sampler
		},
	) {}

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

		return this.options.decider.shouldSample(context, traceId, spanName, spanKind, attributes, links)
	}

	toString(): string {
		return `SplunkSampler{decider=${this.options.decider.toString()}}`
	}
}
