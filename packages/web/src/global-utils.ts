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

import { diag } from '@opentelemetry/api'
import { VERSION } from './version'

const GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for('opentelemetry.js.api.1')

const GLOBAL_SPLUNK_RUM_KEY = 'splunk.rum'

const GLOBAL_SPLUNK_RUM_VERSION_KEY = `${GLOBAL_SPLUNK_RUM_KEY}.version`

const globalThisTyped = globalThis as typeof globalThis & {
	[GLOBAL_OPENTELEMETRY_API_KEY]?: {
		[GLOBAL_SPLUNK_RUM_KEY]?: unknown
		[GLOBAL_SPLUNK_RUM_VERSION_KEY]?: string
	}
}

/**
 * otel-api's global function. This isn't exported by otel/api but would be
 * super useful to register global components for experimental purposes...
 * For us, it's included to register components accessed by other packages,
 * eg. sharing session id manager with session recorder
 */
export function registerGlobal(instance: unknown, allowOverride = false): boolean {
	if (!globalThisTyped[GLOBAL_OPENTELEMETRY_API_KEY]) {
		diag.error('SplunkRum: Tried to access global before otel setup')
		return false
	}

	const api = globalThisTyped[GLOBAL_OPENTELEMETRY_API_KEY]

	if (!api[GLOBAL_SPLUNK_RUM_VERSION_KEY]) {
		api[GLOBAL_SPLUNK_RUM_VERSION_KEY] = VERSION
	}

	if (api[GLOBAL_SPLUNK_RUM_VERSION_KEY] !== VERSION) {
		diag.error(`SplunkRum: Global: Multiple versions detected (${VERSION} already registered)`)
		return false
	}

	if (!allowOverride && api[GLOBAL_SPLUNK_RUM_KEY]) {
		diag.error(`SplunkRum: Attempted duplicate registration of otel API ${GLOBAL_SPLUNK_RUM_KEY}`)
		return false
	}

	api[GLOBAL_SPLUNK_RUM_KEY] = instance
	return true
}

export function unregisterGlobal(): boolean {
	const api = globalThisTyped[GLOBAL_OPENTELEMETRY_API_KEY]
	if (!api) {
		diag.warn(
			`OTel API ref was missing while trying to unregister ${GLOBAL_SPLUNK_RUM_KEY} or ${GLOBAL_SPLUNK_RUM_VERSION_KEY}`,
		)
		return false
	}

	if (!!api[GLOBAL_SPLUNK_RUM_VERSION_KEY] && api[GLOBAL_SPLUNK_RUM_VERSION_KEY] !== VERSION) {
		diag.warn(
			`SplunkRum version in OTel API ref (${api[GLOBAL_SPLUNK_RUM_VERSION_KEY]}) didn't match our version (${VERSION}).`,
		)
	}

	delete api[GLOBAL_SPLUNK_RUM_KEY]
	delete api[GLOBAL_SPLUNK_RUM_VERSION_KEY]
	return true
}

export function getGlobal() {
	return globalThisTyped[GLOBAL_OPENTELEMETRY_API_KEY]?.[GLOBAL_SPLUNK_RUM_KEY]
}
