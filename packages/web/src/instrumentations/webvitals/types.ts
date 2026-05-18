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

import type { InstrumentationConfig } from '@opentelemetry/instrumentation'
import type {
	AttributionReportOpts,
	CLSMetricWithAttribution,
	FCPMetricWithAttribution,
	INPAttributionReportOpts,
	INPMetricWithAttribution,
	LCPMetricWithAttribution,
	TTFBMetricWithAttribution,
} from 'web-vitals/attribution'

export type WebVitalName = 'cls' | 'fcp' | 'inp' | 'lcp' | 'ttfb'
export type WebVitalMetricWithAttribution =
	| CLSMetricWithAttribution
	| FCPMetricWithAttribution
	| INPMetricWithAttribution
	| LCPMetricWithAttribution
	| TTFBMetricWithAttribution

export type WebVitalReport =
	| { metric: CLSMetricWithAttribution; name: 'cls' }
	| { metric: FCPMetricWithAttribution; name: 'fcp' }
	| { metric: INPMetricWithAttribution; name: 'inp' }
	| { metric: LCPMetricWithAttribution; name: 'lcp' }
	| { metric: TTFBMetricWithAttribution; name: 'ttfb' }

/**
 * Controls how element selectors are emitted on web vitals attribution attributes
 * (e.g. `cls.largest_shift_target`, `inp.interaction_target`, `lcp.target`).
 *
 * - `safe` (default): emit a bounded, structural selector built from tag names,
 *   safe ARIA roles, and `nth-of-type`. Ids, classes, dataset, `aria-label`, and
 *   text content are never included.
 * - `raw`: emit the unfiltered selector produced by `web-vitals` (may include
 *   user-supplied ids/classes and is potentially PII-bearing).
 * - `off`: do not emit the target attribute at all.
 */
export type WebVitalsTargetAttribution = 'safe' | 'raw' | 'off'

/**
 * Controls how the LCP resource URL is emitted on `lcp.url`.
 *
 * - `sanitized` (default): emit `origin + pathname` only; query string and
 *   fragment are stripped. Non-http(s) URLs (e.g. `data:`, `blob:`) are dropped.
 * - `raw`: emit the URL as reported by `web-vitals`.
 * - `off`: do not emit `lcp.url`.
 */
export type WebVitalsLCPUrlAttribution = 'sanitized' | 'raw' | 'off'

/**
 * Privacy-shaping configuration for web vitals attribution attributes.
 *
 * @see WebVitalsTargetAttribution
 * @see WebVitalsLCPUrlAttribution
 */
export type WebVitalsAttributionConfig = {
	/** Policy for the LCP resource URL. @default 'sanitized' */
	lcpUrl?: WebVitalsLCPUrlAttribution
	/** Policy for element selector attributes across CLS, INP, and LCP. @default 'safe' */
	target?: WebVitalsTargetAttribution
}

export interface SplunkWebVitalsInstrumentationConfig extends InstrumentationConfig {
	/**
	 * Enable experimental web vitals attribution attributes. When disabled, webvitals spans
	 * emit only the metric value and shared `webvitals.*` fields.
	 * @default false
	 */
	_experimental_attribution?: boolean

	/**
	 * Enable experimental FCP collection. Pass an object to forward `web-vitals`
	 * {@link AttributionReportOpts} (e.g. `reportAllChanges`).
	 * @default false
	 */
	_experimental_fcp?: boolean | AttributionReportOpts

	/**
	 * Enable experimental TTFB collection. Same semantics as `_experimental_fcp`.
	 * @default false
	 */
	_experimental_ttfb?: boolean | AttributionReportOpts

	/**
	 * If true, the webvitals spans will have their start time aligned with the document load span,
	 * and will inherit the `location.href` attribute from the document load span if available.
	 * When the document load span does not arrive within a bounded grace period (e.g. the document
	 * instrumentation is disabled), metrics are reported with the current wall-clock time instead.
	 * @default true
	 */
	alignWebVitalsSpansWithDocumentLoad?: boolean

	/**
	 * Controls how attribution attributes are exported on `webvitals` spans when
	 * `_experimental_attribution` is enabled.
	 * Defaults to privacy-preserving values (`target: 'safe'`, `lcpUrl: 'sanitized'`).
	 * @see WebVitalsAttributionConfig
	 */
	attribution?: WebVitalsAttributionConfig

	/**
	 * Enable CLS collection. Pass an object to forward `web-vitals`
	 * {@link AttributionReportOpts} (e.g. `reportAllChanges`). When `target: 'safe'`
	 * is in effect, `generateTarget` is set by this instrumentation and any caller-provided
	 * `generateTarget` is ignored.
	 * @default true
	 */
	cls?: boolean | AttributionReportOpts

	/**
	 * Enable INP collection. Same semantics as `cls`. The `includeProcessedEventEntries`
	 * field defaults to `false` to avoid retaining detailed event entries.
	 * @default true
	 */
	inp?: boolean | INPAttributionReportOpts

	/**
	 * Enable LCP collection. Same semantics as `cls`.
	 * @default true
	 */
	lcp?: boolean | AttributionReportOpts
}

export type LayoutShiftRect = {
	height: number
	width: number
	x: number
	y: number
}

export type WebVitalsAttributionOptions = {
	getLCPUrl: (url: string | undefined) => string | undefined
	shouldExportTarget: boolean
}
