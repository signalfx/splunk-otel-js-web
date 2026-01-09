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
import { Attributes } from '@opentelemetry/api'
import { InstrumentationConfig } from '@opentelemetry/instrumentation'
import { FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch'
import { XMLHttpRequestInstrumentationConfig } from '@opentelemetry/instrumentation-xml-http-request'
import { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import { WebTracerConfig } from '@opentelemetry/sdk-trace-web'

import {
	SocketIoClientInstrumentationConfig,
	SplunkErrorInstrumentationConfig,
	SplunkFrustrationSignalsInstrumentationConfig,
	SplunkPostDocLoadResourceInstrumentationConfig,
	SplunkUserInteractionInstrumentationConfig,
	SplunkWebVitalsInstrumentationConfig,
} from '../instrumentations'

export interface SplunkOtelWebOptionsInstrumentations {
	connectivity?: boolean | InstrumentationConfig
	document?: boolean | InstrumentationConfig
	errors?: boolean | SplunkErrorInstrumentationConfig
	fetch?: boolean | FetchInstrumentationConfig
	frustrationSignals?: boolean | SplunkFrustrationSignalsInstrumentationConfig
	interactions?: boolean | SplunkUserInteractionInstrumentationConfig
	longtask?: boolean | InstrumentationConfig
	postload?: boolean | SplunkPostDocLoadResourceInstrumentationConfig
	socketio?: boolean | SocketIoClientInstrumentationConfig
	visibility?: boolean | InstrumentationConfig
	websocket?: boolean | InstrumentationConfig
	webvitals?: boolean | SplunkWebVitalsInstrumentationConfig
	xhr?: boolean | XMLHttpRequestInstrumentationConfig
}

export interface ContextManagerConfig {
	/** Enable async tracking of span parents */
	async?: boolean
	onBeforeContextEnd?: () => void
	onBeforeContextStart?: () => void
}

export type UserTrackingMode = 'noTracking' | 'anonymousTracking'

export interface SplunkOtelWebExporterOptions {
	/**
	 * Allows remapping Span's attributes right before they're serialized.
	 * One potential use case of this method is to remove PII from the attributes.
	 */
	onAttributesSerializing?: (attributes: Attributes, span: ReadableSpan) => Attributes

	/**
	 * Switch from zipkin to otlp for exporting
	 */
	otlp?: boolean
}

export type PersistenceType = 'cookie' | 'localStorage'
export function isPersistenceType(value: string): value is PersistenceType {
	return ['cookie', 'localStorage'].includes(value)
}

type SensitivityRule = {
	rule: 'mask' | 'unmask' | 'exclude'
	selector: string
}

export interface SplunkOtelWebConfig {
	/**
	 * **Experimental** - Enables SPA (Single Page Application) metrics.
	 *
	 * Currently supported metrics:
	 * - **Page Completion Time (PCT)**: Measures the time from a route change until all network
	 *   requests (fetch/XHR) and media elements have finished loading
	 *
	 * @experimental This feature is under active development and may change in future releases.
	 * @default false (disabled)
	 *
	 * @example
	 * ```typescript
	 * // Enable with defaults
	 * _experimental_spaMetrics: true
	 *
	 * // Enable with custom configuration
	 * _experimental_spaMetrics: {
	 *   ignoreUrls: [/analytics\.example\.com/],
	 *   quietTime: 1000,
	 *   maxResourcesToWatch: 100
	 * }
	 * ```
	 */
	_experimental_spaMetrics?:
		| boolean
		| {
				/** URLs to exclude from PCT tracking (e.g., analytics, third-party scripts) */
				ignoreUrls?: Array<string | RegExp>
				/** Maximum number of concurrent resources to track. @default 100 */
				maxResourcesToWatch?: number
				/** Time in milliseconds to wait after last resource loads before considering page complete. @default 1000 */
				quietTime?: number
		  }

	/**
	 * Experimental: Data attribute names to capture from elements during user interactions.
	 *
	 * When specified, these data attributes will be collected from interacted elements and attached
	 * to interaction spans as span attributes. Only data-* attributes are captured.
	 * Currently supported for click and rage click spans.
	 *
	 * Attribute names can be specified in either format:
	 * - Hyphenated: `'data-test-id'`, `'data-user-name'`
	 * - CamelCase: `'testId'`, `'userName'` (without `data-` prefix)
	 *
	 * Both formats are normalized to `dataset.camelCase` in the span attributes.
	 * @example ['data-test-id', 'userName'] // Both are valid
	 */
	_experimental_dataAttributesToCapture?: string[]

	/** Allows http beacon urls */
	allowInsecureBeacon?: boolean

	/** Application name */
	applicationName?: string

	/** Destination for the captured data */
	beaconEndpoint?: string

	/** Options for context manager */
	context?: ContextManagerConfig

	/** Sets session cookie to this domain */
	cookieDomain?: string

	/** Turns on/off internal debug logging */
	debug?: boolean

	/**
	 * Sets a value for the `environment` attribute (persists through calls to `setGlobalAttributes()`)
	 * */
	deploymentEnvironment?: string

	/*
	 * If true, automation frameworks like Cypress, Selenium, Playwright, Synthetics will not be tracked. Defaults to false.
	 */
	disableAutomationFrameworks?: boolean

	/*
	 * If true, bots like google bot, bing bot, and others will be blocked. Defaults to false.
	 */
	disableBots?: boolean

	/** Allows configuring how telemetry data is sent to the backend */
	exporter?: SplunkOtelWebExporterOptions

	/** Sets attributes added to every Span. */
	globalAttributes?: Attributes

	/**
	 * Applies for XHR, Fetch and Websocket URLs. URLs that partially match any regex in ignoreUrls will not be traced.
	 * In addition, URLs that are _exact matches_ of strings in ignoreUrls will also not be traced.
	 * */
	ignoreUrls?: Array<string | RegExp>

	/** Configuration for instrumentation modules. */
	instrumentations?: SplunkOtelWebOptionsInstrumentations

	/**
	 * Specifies where session data should be stored.
	 *
	 * Available options:
	 * - `'cookie'` (default): Session data will be stored in a browser cookie.
	 *
	 * - `'localStorage'`: Session data will be stored in the browser's localStorage.
	 *
	 * If not specified, `'cookie'` will be used as the default storage method.
	 */
	persistence?: PersistenceType

	/**
	 * Configuration for privacy regarding collecting text from clicks.
	 * - `'maskAllText'` (default: true): Masks all text from text nodes, unless unmask rule applies.
	 * - `'sensitivityRules'`: Array of rules for determining sensitivity of text in the document. Rules are applied
	 *   based on CSS selectors. The later rules override the earlier ones.
	 */
	privacy?: {
		maskAllText: boolean
		sensitivityRules: SensitivityRule[]
	}

	/**
	 * The name of your organization’s realm. Automatically configures beaconUrl with correct URL
	 */
	realm?: string

	/**
	 * Publicly-visible rum access token value. Please do not paste any other access token or auth value into here, as this
	 * will be visible to every user of your app
	 */
	rumAccessToken?: string

	spanProcessors?: Array<SpanProcessor>

	/**
	 * Config options passed to web tracer
	 */
	tracer?: WebTracerConfig

	user?: {
		/** Sets tracking mode of user. Defaults to 'noTracking'. */
		trackingMode?: UserTrackingMode
	}

	/**
	 * Sets a value for the 'app.version' attribute
	 */
	version?: string
}
