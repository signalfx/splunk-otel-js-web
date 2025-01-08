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
import { createWebTracerProvider } from './web-tracer-provider'
import { Span } from '@opentelemetry/api'

export const createSpan = (name: string) => {
	const webTracerProvider = createWebTracerProvider()
	const tracer = webTracerProvider.getTracer('test')
	const span = tracer.startSpan(name)

	return span as Span & { attributes: Record<string, string> }
}
