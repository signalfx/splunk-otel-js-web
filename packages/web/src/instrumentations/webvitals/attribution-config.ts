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

import { WebVitalsAttributionConfig, WebVitalsAttributionOption } from './types'

const DEFAULT_ATTRIBUTION_CONFIG: Required<WebVitalsAttributionConfig> = {
	lcpUrl: 'sanitized',
	target: 'safe',
}

export function getResolvedWebVitalsAttributionConfig(
	config?: WebVitalsAttributionOption,
): Required<WebVitalsAttributionConfig> {
	return {
		...DEFAULT_ATTRIBUTION_CONFIG,
		...(isWebVitalsAttributionConfig(config) ? config : {}),
	}
}

export function isWebVitalsAttributionEnabled(config?: WebVitalsAttributionOption): boolean {
	return config === true || isWebVitalsAttributionConfig(config)
}

function isWebVitalsAttributionConfig(config?: WebVitalsAttributionOption): config is WebVitalsAttributionConfig {
	return typeof config === 'object' && config !== null
}
