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
import { Attributes } from '@opentelemetry/api'
import { WebTracerConfig } from '@opentelemetry/sdk-trace-web'
import { InstrumentationConfig } from '@opentelemetry/instrumentation'
import { FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch'
import { SplunkUserInteractionInstrumentationConfig } from '../SplunkUserInteractionInstrumentation'
import { SplunkPostDocLoadResourceInstrumentationConfig } from '../SplunkPostDocLoadResourceInstrumentation'
import { SocketIoClientInstrumentationConfig } from '../SplunkSocketIoClientInstrumentation'
import { WebVitalsInstrumentationConfig } from '../webvitals'
import { XMLHttpRequestInstrumentationConfig } from '@opentelemetry/instrumentation-xml-http-request'
import { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base'

export interface SplunkOtelWebOptionsInstrumentations {
	connectivity?: boolean | InstrumentationConfig
	document?: boolean | InstrumentationConfig
	errors?: boolean
	fetch?: boolean | FetchInstrumentationConfig
	interactions?: boolean | SplunkUserInteractionInstrumentationConfig
	longtask?: boolean | InstrumentationConfig
	postload?: boolean | SplunkPostDocLoadResourceInstrumentationConfig
	socketio?: boolean | SocketIoClientInstrumentationConfig
	visibility?: boolean | InstrumentationConfig
	websocket?: boolean | InstrumentationConfig
	webvitals?: boolean | WebVitalsInstrumentationConfig
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

export interface SplunkOtelWebConfig {
	/**
	 * If enabled, all spans are treated as activity and extend the duration of the session. Defaults to false.
	 */
	_experimental_allSpansExtendSession?: boolean

	/*
	 * If enabled, longtask will not start the new session. Defaults to false.
	 */
	_experimental_longtaskNoStartSession?: boolean

	/** Allows http beacon urls */
	allowInsecureBeacon?: boolean

	/** Application name
	 * @deprecated Renamed to `applicationName`
	 */
	app?: string

	/** Application name */
	applicationName?: string

	/** Destination for the captured data */
	beaconEndpoint?: string

	/**
	 * Destination for the captured data
	 * @deprecated Renamed to `beaconEndpoint`, or use realm
	 */
	beaconUrl?: string

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

	/**
	 * Sets a value for the `environment` attribute (persists through calls to `setGlobalAttributes()`)
	 * @deprecated Renamed to `deploymentEnvironment`
	 */
	environment?: string

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
	 * The name of your organization’s realm. Automatically configures beaconUrl with correct URL
	 */
	realm?: string

	/**
	 * Publicly-visible rum access token value. Please do not paste any other access token or auth value into here, as this
	 * will be visible to every user of your app
	 */
	rumAccessToken?: string

	/**
	 * Publicly-visible `rumAuth` value.  Please do not paste any other access token or auth value into here, as this
	 * will be visible to every user of your app
	 * @deprecated Renamed to rumAccessToken
	 */
	rumAuth?: string

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
