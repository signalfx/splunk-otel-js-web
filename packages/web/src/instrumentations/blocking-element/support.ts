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

import type { SpaMetricsOptions, SplunkOtelWebConfig } from '../../types'

import { DEFAULT_MAX_ELEMENT_SPAN_DURATION } from './constants'

function isUrlOverrideMatch(match: string | RegExp, url: string): boolean {
	if (typeof match === 'string') {
		return url.includes(match)
	}

	// Regexes with global/sticky flags keep state between test() calls, so reset before reuse.
	match.lastIndex = 0
	return match.test(url)
}

function getSpaMetricsConfigForUrl(spaMetrics: SpaMetricsOptions, url: string): SpaMetricsOptions {
	const override = spaMetrics.urlOverrides?.find((urlOverride) => isUrlOverrideMatch(urlOverride.match, url))
	if (!override) {
		return spaMetrics
	}

	// An override that omits monitors/blockingSelectors inherits the base value for that field,
	// matching SpaMetricsManager.resolveConfig's per-field fallback.
	return {
		...override,
		blockingSelectors: override.blockingSelectors ?? spaMetrics.blockingSelectors,
		monitors: override.monitors ?? spaMetrics.monitors,
	}
}

// Reads the raw instrumentations.blockingElement value, not this._config/getConfig() —
// getPluginConfig's pluginDefaults force enabled to false on every instrumentation's processed config.
export function isBlockingElementInstrumentationEnabled(otelConfig: SplunkOtelWebConfig): boolean {
	const blockingElement = otelConfig.instrumentations?.blockingElement
	if (typeof blockingElement === 'object' && blockingElement.enabled !== undefined) {
		return blockingElement.enabled
	}

	if (typeof blockingElement === 'object' || blockingElement === undefined) {
		return isEnabledFromSpaMetrics(otelConfig)
	}

	return blockingElement
}

// Reads the raw instrumentations.blockingElement value, same reasoning as
// isBlockingElementInstrumentationEnabled above — this._config.maxElementSpanDuration would be
// stripped/defaulted before the user's own value could be observed.
export function resolveMaxElementSpanDuration(otelConfig: SplunkOtelWebConfig): number {
	const blockingElement = otelConfig.instrumentations?.blockingElement
	if (typeof blockingElement === 'object' && blockingElement.maxElementSpanDuration !== undefined) {
		return blockingElement.maxElementSpanDuration
	}

	return DEFAULT_MAX_ELEMENT_SPAN_DURATION
}

// Resolved once for the URL active when called; not re-evaluated on later SPA navigations.
export function resolveBlockingElementSelectors(otelConfig: SplunkOtelWebConfig): string[] {
	const spaMetrics = otelConfig.spaMetrics
	if (typeof spaMetrics !== 'object') {
		return []
	}

	const resolved = getSpaMetricsConfigForUrl(spaMetrics, location.href)
	return resolved.blockingSelectors ?? []
}

function isEnabledFromSpaMetrics(otelConfig: SplunkOtelWebConfig): boolean {
	const spaMetrics = otelConfig.spaMetrics
	if (typeof spaMetrics !== 'object') {
		return false
	}

	const resolved = getSpaMetricsConfigForUrl(spaMetrics, location.href)
	return (resolved.monitors ?? []).includes('elements') && (resolved.blockingSelectors ?? []).length > 0
}
