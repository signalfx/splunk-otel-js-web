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

import { Attributes, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { _globalThis, SDK_INFO } from '@opentelemetry/core'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource, ResourceAttributes } from '@opentelemetry/resources'
import {
	AlwaysOffSampler,
	AlwaysOnSampler,
	BatchSpanProcessor,
	BufferConfig,
	ConsoleSpanExporter,
	ParentBasedSampler,
	SimpleSpanProcessor,
	SpanExporter,
	SpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

import { InternalEventTarget, SplunkOtelWebEventTarget } from './event-target'
import { type SplunkExporterConfig } from './exporters/common'
import { SplunkOTLPTraceExporter } from './exporters/otlp'
import { SplunkZipkinExporter } from './exporters/zipkin'
import { registerGlobal, unregisterGlobal } from './global-utils'
import {
	DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES,
	DEFAULT_AUTO_INSTRUMENTED_EVENTS,
	ERROR_INSTRUMENTATION_NAME,
	SplunkConnectivityInstrumentation,
	SplunkDocumentLoadInstrumentation,
	SplunkErrorInstrumentation,
	SplunkFetchInstrumentation,
	SplunkLongTaskInstrumentation,
	SplunkPageVisibilityInstrumentation,
	SplunkPostDocLoadResourceInstrumentation,
	SplunkSocketIoClientInstrumentation,
	SplunkUserInteractionInstrumentation,
	SplunkWebSocketInstrumentation,
	SplunkWebVitalsInstrumentation,
	SplunkXhrInstrumentation,
	UserInteractionEventsConfig,
} from './instrumentations'
import { BrowserInstanceService } from './services/browser-instance-service'
import { SessionBasedSampler } from './session-based-sampler'
import { SplunkContextManager } from './splunk-context-manager'
import { SplunkSamplerWrapper } from './splunk-sampler-wrapper'
import { SplunkSpanAttributesProcessor } from './splunk-span-attributes-processor'
import { SplunkWebTracerProvider } from './splunk-web-tracer-provider'
import { getSyntheticsRunId, SYNTHETICS_RUN_ID_ATTRIBUTE } from './synthetics'
import {
	isPersistenceType,
	SplunkOtelWebConfig,
	SplunkOtelWebExporterOptions,
	SplunkOtelWebOptionsInstrumentations,
	UserTrackingMode,
} from './types'
import { forgetAnonymousId, getOrCreateAnonymousId } from './user-tracking'
import { generateId, getPluginConfig } from './utils'
import { getValidAttributes, SpanContext } from './utils/attributes'
import { isAgentLoadedViaLatestTag } from './utils/detect-latest'
import { isBot } from './utils/is-bot'
import { parseVersion } from './utils/parse-version'
import { VERSION } from './version'

export { type SplunkExporterConfig } from './exporters/common'
export { SplunkZipkinExporter } from './exporters/zipkin'
export * from './session-based-sampler'
export * from './splunk-web-tracer-provider'
import { SessionManager, SessionState, StorageManager } from './managers'

interface SplunkOtelWebConfigInternal extends SplunkOtelWebConfig {
	bufferSize?: number
	bufferTimeout?: number

	exporter: SplunkOtelWebExporterOptions & {
		factory: (config: SplunkExporterConfig & { otlp?: boolean }) => SpanExporter
	}

	instrumentations: SplunkOtelWebOptionsInstrumentations

	spanProcessor: {
		factory: <T extends BufferConfig>(exporter: SpanExporter, config: T) => SpanProcessor
	}
}

const OPTIONS_DEFAULTS: SplunkOtelWebConfigInternal = {
	applicationName: 'unknown-browser-app',
	beaconEndpoint: undefined,
	bufferSize: 50, // spans, tradeoff between batching and hitting sendBeacon invididual limits
	bufferTimeout: 4000, //millis, tradeoff between batching and loss of spans by not sending before page close
	disableAutomationFrameworks: false,
	disableBots: false,
	exporter: {
		factory: (options) => {
			if (options.otlp) {
				return new SplunkOTLPTraceExporter(options)
			}

			return new SplunkZipkinExporter(options)
		},
	},
	instrumentations: {},
	persistence: 'cookie',
	rumAccessToken: undefined,
	spanProcessor: {
		factory: (exporter, config) => new BatchSpanProcessor(exporter, config),
	},
}

const INSTRUMENTATIONS = [
	{ confKey: 'document', disable: false, Instrument: SplunkDocumentLoadInstrumentation },
	{ confKey: 'xhr', disable: false, Instrument: SplunkXhrInstrumentation },
	{ confKey: 'interactions', disable: false, Instrument: SplunkUserInteractionInstrumentation },
	{ confKey: 'postload', disable: false, Instrument: SplunkPostDocLoadResourceInstrumentation },
	{ confKey: 'fetch', disable: false, Instrument: SplunkFetchInstrumentation },
	{ confKey: 'websocket', disable: true, Instrument: SplunkWebSocketInstrumentation },
	{ confKey: 'longtask', disable: false, Instrument: SplunkLongTaskInstrumentation },
	{ confKey: ERROR_INSTRUMENTATION_NAME, disable: false, Instrument: SplunkErrorInstrumentation },
	{ confKey: 'visibility', disable: true, Instrument: SplunkPageVisibilityInstrumentation },
	{ confKey: 'connectivity', disable: true, Instrument: SplunkConnectivityInstrumentation },
	{ confKey: 'webvitals', disable: false, Instrument: SplunkWebVitalsInstrumentation },
	{ confKey: 'socketio', disable: true, Instrument: SplunkSocketIoClientInstrumentation },
] as const

export const INSTRUMENTATIONS_ALL_DISABLED: SplunkOtelWebOptionsInstrumentations = INSTRUMENTATIONS.map(
	(instrumentation) => instrumentation.confKey,
).reduce(
	(acc, key) => {
		acc[key] = false
		return acc
	},
	{ webvitals: false } as Record<string, false>,
)

function getBeaconEndpointForRealm(config: SplunkOtelWebConfigInternal) {
	if (config.exporter?.otlp) {
		return `https://rum-ingest.${config.realm}.signalfx.com/v1/rumotlp`
	}

	return `https://rum-ingest.${config.realm}.signalfx.com/v1/rum`
}

function buildExporter(options: SplunkOtelWebConfigInternal) {
	const url = options.beaconEndpoint + (options.rumAccessToken ? '?auth=' + options.rumAccessToken : '')
	return options.exporter.factory({
		onAttributesSerializing: options.exporter.onAttributesSerializing,
		otlp: options.exporter.otlp,
		url,
	})
}

export interface SplunkOtelWebType extends SplunkOtelWebEventTarget {
	AlwaysOffSampler: typeof AlwaysOffSampler
	AlwaysOnSampler: typeof AlwaysOnSampler

	DEFAULT_AUTO_INSTRUMENTED_EVENTS: UserInteractionEventsConfig
	DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES: (keyof HTMLElementEventMap)[]

	ParentBasedSampler: typeof ParentBasedSampler
	SessionBasedSampler: typeof SessionBasedSampler

	/**
	 * Allows experimental options to be passed. No versioning guarantees are given for this method.
	 */
	_internalInit: (options: Partial<SplunkOtelWebConfigInternal>) => void

	_processedOptions: SplunkOtelWebConfigInternal | null

	_processor?: SpanProcessor

	attributesProcessor?: SplunkSpanAttributesProcessor

	deinit: (force?: boolean) => void

	/**
	 * True if library detected an automation framework and was disabled based on 'disableAutomationFrameworks' setting.
	 */
	disabledByAutomationFrameworkDetection?: boolean

	/**
	 * True if library detected a bot and was disabled based on 'disableBots' setting.
	 */
	disabledByBotDetection?: boolean

	getAnonymousId: () => string | undefined

	/**
	 * This method provides access to computed, final value of global attributes, which are applied to all created spans.
	 */
	getGlobalAttributes: () => Attributes

	/**
	 * This method returns current session ID
	 */
	getSessionId: () => string | undefined

	getSessionState: () => SessionState | undefined

	init: (options: SplunkOtelWebConfig) => void

	readonly inited: boolean

	provider?: SplunkWebTracerProvider

	reportError: (error: string | Event | Error | ErrorEvent, context?: SpanContext) => Promise<void>

	resource?: Resource

	sessionManager?: SessionManager

	setGlobalAttributes: (attributes: Attributes) => void

	setUserTrackingMode: (mode: UserTrackingMode) => void

	/**
	 * `userTrackingMode` available values: `'noTracking'` (default) | `'anonymousTracking'`.
	 *  If set to `'anonymousTracking'`, ensure you use the Splunk recorder if used together with the session recorder.
	 */
	userTrackingMode: UserTrackingMode
}

let inited = false
let userTrackingMode: UserTrackingMode = 'noTracking'
let _deregisterInstrumentations: undefined | (() => void)
let _deinitSessionTracking: undefined | (() => void)
let _errorInstrumentation: SplunkErrorInstrumentation | undefined
let _postDocLoadInstrumentation: SplunkPostDocLoadResourceInstrumentation | undefined
let eventTarget: InternalEventTarget | undefined
let _sessionStateUnsubscribe: undefined | (() => void)
const isLatestTagUsed = isAgentLoadedViaLatestTag()

export const SplunkRum: SplunkOtelWebType = {
	_internalInit: function (options: Partial<SplunkOtelWebConfigInternal>) {
		SplunkRum.init({
			...OPTIONS_DEFAULTS,
			...options,
		})
	},
	_processedOptions: null,

	addEventListener(name, callback): void {
		eventTarget?.addEventListener(name, callback)
	},

	AlwaysOffSampler,

	// Re-export samplers as properties for easier use in CDN build
	AlwaysOnSampler,

	DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES,

	DEFAULT_AUTO_INSTRUMENTED_EVENTS,

	deinit(force = false) {
		if (!inited && !force) {
			return
		}

		try {
			_deregisterInstrumentations?.()
			_deregisterInstrumentations = undefined

			_deinitSessionTracking?.()
			_deinitSessionTracking = undefined

			_sessionStateUnsubscribe?.()
			this.sessionManager?.stop()

			void this.provider?.shutdown()
			delete this.provider

			eventTarget = undefined

			unregisterGlobal()

			forgetAnonymousId()
		} catch (error) {
			diag.warn('[Splunk]: SplunkRum.deinit() encountered an error during cleanup.', { error })
		} finally {
			inited = false
			diag.disable()
		}
	},

	getAnonymousId() {
		if (!this._processedOptions) {
			return
		}

		if (userTrackingMode === 'anonymousTracking') {
			try {
				return getOrCreateAnonymousId({
					domain: this._processedOptions.cookieDomain,
					useLocalStorage: this._processedOptions.persistence === 'localStorage',
				})
			} catch (error) {
				diag.warn(
					'[Splunk]: SplunkRum.getAnonymousId() encountered an error while trying to get anonymous ID.',
					{ error },
				)
				return
			}
		}
	},

	getGlobalAttributes(this: SplunkOtelWebType) {
		return this.attributesProcessor?.getGlobalAttributes() || {}
	},

	getSessionId() {
		if (!inited) {
			return
		}

		try {
			return this.sessionManager?.getSessionId()
		} catch (error) {
			diag.warn('[Splunk]: SplunkRum.getSessionId() encountered an error while trying to get session ID.', {
				error,
			})
		}
	},

	getSessionState() {
		if (!inited) {
			return
		}

		try {
			return this.sessionManager?.getSessionState()
		} catch (error) {
			diag.warn('[Splunk]: SplunkRum.getSessionState() encountered an error while trying to get session state.', {
				error,
			})
		}
	},

	init: function (options) {
		userTrackingMode = options.user?.trackingMode ?? 'noTracking'

		if (typeof window !== 'object') {
			console.warn(
				'[Splunk]: SplunkRum.init() - Error: This library is intended to run in a browser environment. Please ensure the code is evaluated within a browser context.',
			)
			return
		}

		// "env" based config still a bad idea for web
		if (!('OTEL_TRACES_EXPORTER' in _globalThis)) {
			// @ts-expect-error OTEL_TRACES_EXPORTER is not defined in the global scope
			_globalThis.OTEL_TRACES_EXPORTER = 'none'
		}

		if (inited) {
			diag.warn('[Splunk]: SplunkRum.init() - already initialized.')
			return
		}

		try {
			// touches otel globals, our registerGlobal requires this first
			diag.setLogger(new DiagConsoleLogger(), options?.debug ? DiagLogLevel.DEBUG : DiagLogLevel.WARN)

			if (isLatestTagUsed) {
				const { exactVersion, majorVersion, minorVersion } = parseVersion(VERSION)
				const cdnBase = 'https://cdn.signalfx.com/o11y-gdi-rum'

				diag.warn(
					'[Splunk]: You are using the "latest" version of splunk-otel-web.js. ' +
						'This automatically pulls the newest released version, which may introduce breaking changes without notice. ' +
						'This can cause unexpected behavior in production environments. ' +
						'Please use a version lock strategy instead:\n' +
						`  - Major version lock (recommended): ${cdnBase}/${majorVersion}/splunk-otel-web.js\n` +
						`  - Minor version lock:               ${cdnBase}/${minorVersion}/splunk-otel-web.js\n` +
						`  - Exact version lock:               ${cdnBase}/${exactVersion}/splunk-otel-web.js\n\n` +
						'See: https://quickdraw.splunk.com/redirect/?location=rum.browser.cdn&product=Observability&version=current',
				)
			}

			const registered = registerGlobal(this)
			if (!registered) {
				return
			}

			if (typeof Symbol !== 'function') {
				diag.warn('[Splunk]: SplunkRum.init() - browser not supported, disabling instrumentation.')
				return
			}

			if (options.disableBots && isBot(navigator.userAgent)) {
				this.disabledByBotDetection = true
				diag.warn('[Splunk]: SplunkRum.init() - will not be initialized, bots are not allowed.')
				return
			}

			if (options.disableAutomationFrameworks && navigator.webdriver) {
				this.disabledByAutomationFrameworkDetection = true
				diag.warn(
					'[Splunk]: SplunkRum.init() - will not be initialized, automation frameworks are not allowed.',
				)
				return
			}

			eventTarget = new InternalEventTarget()

			const processedOptions: SplunkOtelWebConfigInternal = Object.assign({}, OPTIONS_DEFAULTS, options, {
				exporter: Object.assign({}, OPTIONS_DEFAULTS.exporter, options.exporter),
			})

			if (
				!processedOptions.persistence ||
				(processedOptions.persistence && !isPersistenceType(processedOptions.persistence))
			) {
				diag.error(
					`[Splunk]: SplunkRum.init() - Invalid persistence flag: The value for "persistence" must be either "cookie", "localStorage", or omitted entirely, but was: ${processedOptions.persistence}`,
				)
				return
			}

			this._processedOptions = processedOptions

			if (processedOptions.realm) {
				if (processedOptions.beaconEndpoint) {
					diag.warn('[Splunk]: SplunkRum.init() - Realm value ignored (beaconEndpoint has been specified)')
				} else {
					processedOptions.beaconEndpoint = getBeaconEndpointForRealm(processedOptions)
				}
			}

			if (!processedOptions.debug) {
				if (!processedOptions.beaconEndpoint) {
					diag.error(
						'[Splunk]: SplunkRum.init() - beaconEndpoint is required. SplunkRum will not be initialized.',
					)
					return
				} else if (
					!processedOptions.beaconEndpoint.startsWith('https') &&
					!processedOptions.allowInsecureBeacon
				) {
					diag.error(
						'[Splunk]: SplunkRum.init() - beaconEndpoint not using https is unsafe, if you want to force it use allowInsecureBeacon option. SplunkRum will not be initialized.',
					)
					return
				}

				if (!processedOptions.rumAccessToken) {
					diag.warn('[Splunk]: SplunkRum.init() - rumAccessToken will be required in the future')
				}
			}

			const instanceId = generateId(64)

			const { applicationName, deploymentEnvironment, ignoreUrls, version } = processedOptions
			// enabled: false prevents registerInstrumentations from enabling instrumentations in constructor
			// they will be enabled in registerInstrumentations
			const pluginDefaults = { enabled: false, ignoreUrls }

			const resourceAttrs: ResourceAttributes = {
				...SDK_INFO,
				'app': applicationName,
				[SemanticResourceAttributes.TELEMETRY_SDK_NAME]: '@splunk/otel-web',
				[SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: VERSION,
				// Splunk specific attributes
				'splunk.rumVersion': VERSION,
				'splunk.scriptInstance': instanceId,
			}

			if (BrowserInstanceService.id) {
				resourceAttrs['browser.instance.id'] = BrowserInstanceService.id
			}

			const syntheticsRunId = getSyntheticsRunId()
			if (syntheticsRunId) {
				resourceAttrs[SYNTHETICS_RUN_ID_ATTRIBUTE] = syntheticsRunId
			}

			const storageManager = new StorageManager({
				domain: processedOptions.cookieDomain,
				sessionPersistence: processedOptions.persistence,
			})
			this.sessionManager = new SessionManager(storageManager)
			this.sessionManager.start()
			_sessionStateUnsubscribe = this.sessionManager.subscribe(({ currentState, previousState }) => {
				if (!previousState) {
					eventTarget?.emit('session-changed', { sessionId: currentState.id })
				} else if (previousState.id !== currentState.id) {
					eventTarget?.emit('session-changed', { sessionId: currentState.id })
				}
			})

			this.resource = new Resource(resourceAttrs)

			this.attributesProcessor = new SplunkSpanAttributesProcessor(
				this.sessionManager,
				{
					...(deploymentEnvironment
						? { 'deployment.environment': deploymentEnvironment, 'environment': deploymentEnvironment }
						: {}),
					...(version ? { 'app.version': version } : {}),
					...processedOptions.globalAttributes,
				},
				this._processedOptions.persistence === 'localStorage',
				() => userTrackingMode,
				processedOptions.cookieDomain,
			)

			const spanProcessors: SpanProcessor[] = [this.attributesProcessor]

			if (processedOptions.beaconEndpoint) {
				const exporter = buildExporter(processedOptions)
				const spanProcessor = processedOptions.spanProcessor.factory(exporter, {
					maxExportBatchSize: processedOptions.bufferSize,
					scheduledDelayMillis: processedOptions.bufferTimeout,
				})
				spanProcessors.push(spanProcessor)
				this._processor = spanProcessor
			}

			if (processedOptions.debug) {
				spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()))
			}

			if (options.spanProcessors) {
				spanProcessors.push(...options.spanProcessors)
			}

			const provider = new SplunkWebTracerProvider({
				...processedOptions.tracer,
				resource: this.resource,
				sampler: new SplunkSamplerWrapper({
					decider: processedOptions.tracer?.sampler ?? new AlwaysOnSampler(),
				}),
				spanProcessors,
			})

			const instrumentations = INSTRUMENTATIONS.map(({ confKey, disable, Instrument }) => {
				const pluginConf = getPluginConfig(processedOptions.instrumentations[confKey], pluginDefaults, disable)
				if (pluginConf) {
					const instrumentation =
						Instrument === SplunkLongTaskInstrumentation
							? new Instrument(pluginConf, options)
							: // @ts-expect-error Can't mark in any way that processedOptions.instrumentations[confKey] is of specifc config type
								new Instrument(pluginConf, options)

					if (
						confKey === ERROR_INSTRUMENTATION_NAME &&
						instrumentation instanceof SplunkErrorInstrumentation
					) {
						_errorInstrumentation = instrumentation
					}

					if (confKey === 'postload' && instrumentation instanceof SplunkPostDocLoadResourceInstrumentation) {
						_postDocLoadInstrumentation = instrumentation
					}

					return instrumentation
				}

				return null
				// eslint-disable-next-line unicorn/prefer-native-coercion-functions
			}).filter((a): a is Exclude<typeof a, null> => Boolean(a))

			window.addEventListener('visibilitychange', () => {
				// this condition applies when the page is hidden or when it's closed
				// see for more details: https://developers.google.com/web/updates/2018/07/page-lifecycle-api#developer-recommendations-for-each-state
				if (document.visibilityState === 'hidden') {
					void this._processor?.forceFlush()
				}
			})

			provider.register({
				contextManager: new SplunkContextManager({
					...processedOptions.context,
					onBeforeContextEnd: () => _postDocLoadInstrumentation?.onBeforeContextChange(),
					onBeforeContextStart: () => _postDocLoadInstrumentation?.onBeforeContextChange(),
				}),
			})

			// After context manager registration so instrumentation event listeners are affected accordingly
			_deregisterInstrumentations = registerInstrumentations({
				instrumentations,
				tracerProvider: provider,
			})

			this.provider = provider

			inited = true
			diag.info('SplunkRum.init() complete')
		} catch (error) {
			diag.warn('[Splunk]: SplunkRum.init() - Failed to initialize due to internal exception.', { error })
		}
	},

	get inited(): boolean {
		return inited
	},

	ParentBasedSampler,

	removeEventListener(name, callback): void {
		try {
			eventTarget?.removeEventListener(name, callback)
		} catch (error) {
			diag.warn(
				'[Splunk]: SplunkRum.removeEventListener() encountered an error while trying to remove event listener.',
				{ error },
			)
		}
	},

	async reportError(error: string | Event | Error | ErrorEvent, context: SpanContext = {}) {
		if (!inited) {
			diag.warn(
				'[Splunk]: SplunkRum.reportError() - Splunk RUM agent is not initialized. Call SplunkRum.init() first. Error will not be reported.',
			)
			return
		}

		if (!_errorInstrumentation) {
			diag.warn(
				'[Splunk]: SplunkRum.reportError() - Error instrumentation is disabled. Enable it in configuration to report errors.',
			)
			return
		}

		if (!error) {
			diag.warn(
				'[Splunk]: SplunkRum.reportError() - Called with empty or null error argument. Provide a valid error to report.',
			)
			return
		}

		if (!_errorInstrumentation.isValidErrorArg(error)) {
			diag.warn(
				'[Splunk]: SplunkRum.reportError() - Invalid error argument type. Expected string, Error, ErrorEvent, or Event object. Error will not be reported.',
			)
			return
		}

		try {
			const parsedAdditionalAttributes = getValidAttributes(context)
			await _errorInstrumentation.report('SplunkRum.reportError', error, parsedAdditionalAttributes)
		} catch (caughtError) {
			diag.warn('[Splunk]: SplunkRum.reportError() - Failed to report error due to internal exception.', {
				error: caughtError,
			})
		}
	},

	SessionBasedSampler,

	setGlobalAttributes(this: SplunkOtelWebType, attributes?: Attributes) {
		try {
			this.attributesProcessor?.setGlobalAttributes(attributes)
			eventTarget?.emit('global-attributes-changed', {
				attributes: this.attributesProcessor?.getGlobalAttributes() || {},
			})
		} catch (error) {
			diag.warn(
				'[Splunk]: SplunkRum.setGlobalAttributes() - Failed to set global attributes due to internal error. Check attribute format and values.',
				{ error },
			)
		}
	},

	setUserTrackingMode(mode: UserTrackingMode) {
		userTrackingMode = mode
	},

	get userTrackingMode() {
		return userTrackingMode
	},
}

export default SplunkRum

export { type SplunkOtelWebConfig, type SplunkOtelWebExporterOptions } from './types'
