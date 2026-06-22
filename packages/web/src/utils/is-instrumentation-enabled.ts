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

import type { SplunkOtelWebOptionsInstrumentations } from '../types'

import { getPluginConfig } from '../utils'

type PluginDefaults = {
	enabled: boolean
	ignoreUrls?: Array<string | RegExp>
}

export function isInstrumentationEnabled(
	instrumentations: SplunkOtelWebOptionsInstrumentations,
	confKey: keyof SplunkOtelWebOptionsInstrumentations,
	pluginDefaults: PluginDefaults,
	defaultDisable: boolean,
): boolean {
	const instrumentationConfig = instrumentations[confKey]
	if (
		instrumentationConfig === false ||
		(typeof instrumentationConfig === 'object' && instrumentationConfig.enabled === false)
	) {
		return false
	}

	return (
		getPluginConfig(
			instrumentationConfig as Record<string, unknown> | boolean | undefined,
			pluginDefaults,
			defaultDisable,
		) !== false
	)
}
