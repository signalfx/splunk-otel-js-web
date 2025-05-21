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

const GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for('opentelemetry.js.api.1')

const GLOBAL_SPLUNK_RUM_KEY = 'splunk.rum'

const GLOBAL_SPLUNK_RUM_VERSION_KEY = `${GLOBAL_SPLUNK_RUM_KEY}.version`

/**
 * otel-api's global function. This isn't exported by otel/api but would be
 * super useful to access global components for experimental purposes...
 * For us, it's included to access components accessed by other packages,
 * eg. sharing session id manager with session recorder
 */
export function getGlobal<Type>(): Type | undefined {
	// @ts-expect-error FIXME: Symbol type is not assignable to string
	return globalThis[GLOBAL_OPENTELEMETRY_API_KEY]?.[GLOBAL_SPLUNK_RUM_KEY]
}

export function getSplunkRumVersion(): string | undefined {
	// @ts-expect-error FIXME: Symbol type is not assignable to string
	return globalThis[GLOBAL_OPENTELEMETRY_API_KEY]?.[GLOBAL_SPLUNK_RUM_VERSION_KEY]
}
