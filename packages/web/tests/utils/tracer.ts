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
import type { Tracer } from '@opentelemetry/api'
import { assert } from 'vitest'

import SplunkRum from '../../src/index'

export function getTracer(name: string): Tracer {
	const tracer = SplunkRum.provider?.getTracer(name)
	assert(tracer, 'Tracer should be defined')

	return tracer
}
