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

export const createDebugSpan = (name: string, attributes: Record<string, string | number> = {}) => {
	const provider = window.SplunkRum.provider

	if (!provider) {
		setTimeout(() => createDebugSpan(name, attributes), 100)
		return
	}

	const tracer = provider.getTracer('debug')
	const span = tracer.startSpan(`debug:${name}`, {
		attributes: {
			...Object.fromEntries(Object.entries(attributes).map(([key, value]) => [`debug.${key}`, value])),
			'debug.performanceTime': new Date(performance.timeOrigin + performance.now()).toISOString(),
			'debug.message': name,
		},
	})

	console.debug('Creating debug span', span)

	span.end()
}
