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

import './polyfill-safari10'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import {
	ConsoleSpanExporter,
	SimpleSpanProcessor,
	BatchSpanProcessor,
	SpanExporter,
	SpanProcessor,
	BufferConfig,
	AlwaysOffSampler,
	AlwaysOnSampler,
	ParentBasedSampler,
} from '@opentelemetry/sdk-trace-base'
import { Attributes, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { SplunkDocumentLoadInstrumentation } from './SplunkDocumentLoadInstrumentation'
import { SplunkXhrPlugin } from './SplunkXhrPlugin'
import { SplunkFetchInstrumentation } from './SplunkFetchInstrumentation'
import {
	SplunkUserInteractionInstrumentation,
	DEFAULT_AUTO_INSTRUMENTED_EVENTS,
	DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES,
	UserInteractionEventsConfig,
} from './SplunkUserInteractionInstrumentation'
import { type SplunkExporterConfig } from './exporters/common'
import { SplunkZipkinExporter } from './exporters/zipkin'
import { ERROR_INSTRUMENTATION_NAME, SplunkErrorInstrumentation } from './SplunkErrorInstrumentation'
import { generateId, getPluginConfig } from './utils'
import {
	checkSessionRecorderType,
	getIsNewSession,
	getRumSessionId,
	initSessionTracking,
	RecorderType,
	updateSessionStatus,
} from './session'
import { SplunkWebSocketInstrumentation } from './SplunkWebSocketInstrumentation'
import { initWebVitals } from './webvitals'
import { SplunkLongTaskInstrumentation } from './SplunkLongTaskInstrumentation'
import { SplunkPageVisibilityInstrumentation } from './SplunkPageVisibilityInstrumentation'
import { SplunkConnectivityInstrumentation } from './SplunkConnectivityInstrumentation'
import { SplunkPostDocLoadResourceInstrumentation } from './SplunkPostDocLoadResourceInstrumentation'
import { SplunkWebTracerProvider } from './SplunkWebTracerProvider'
import { InternalEventTarget, SplunkOtelWebEventTarget } from './EventTarget'
import { SplunkContextManager } from './SplunkContextManager'
import { Resource, ResourceAttributes } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { SDK_INFO } from '@opentelemetry/core'
import { VERSION } from './version'
import { getSyntheticsRunId, SYNTHETICS_RUN_ID_ATTRIBUTE } from './synthetics'
import { SplunkSpanAttributesProcessor } from './SplunkSpanAttributesProcessor'
import { SessionBasedSampler } from './SessionBasedSampler'
import { SplunkSocketIoClientInstrumentation } from './SplunkSocketIoClientInstrumentation'
import { SplunkOTLPTraceExporter } from './exporters/otlp'
import { registerGlobal, unregisterGlobal } from './global-utils'
import { BrowserInstanceService } from './services/BrowserInstanceService'
import { SessionId } from './session'
import { forgetAnonymousId, getOrCreateAnonymousId } from './user-tracking'
import {
	isPersistenceType,
	SplunkOtelWebConfig,
	SplunkOtelWebExporterOptions,
	SplunkOtelWebOptionsInstrumentations,
	UserTrackingMode,
} from './types'
import { isBot } from './utils/is-bot'
import { SplunkSamplerWrapper } from './SplunkSamplerWrapper'
import { SpanContext, getValidAttributes } from './utils/attributes'

export { type SplunkExporterConfig } from './exporters/common'
export { SplunkZipkinExporter } from './exporters/zipkin'
export * from './SplunkWebTracerProvider'
export * from './SessionBasedSampler'

export type { SplunkOtelWebConfig, SplunkOtelWebExporterOptions }

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
	disableBots: false,
	disableAutomationFrameworks: false,
	applicationName: 'unknown-browser-app',
	beaconEndpoint: undefined,
	bufferTimeout: 4000, //millis, tradeoff between batching and loss of spans by not sending before page close
	bufferSize: 50, // spans, tradeoff between batching and hitting sendBeacon invididual limits
	instrumentations: {},
	exporter: {
		factory: (options) => {
			if (options.otlp) {
				return new SplunkOTLPTraceExporter(options)
			}

			return new SplunkZipkinExporter(options)
		},
	},
	persistence: 'cookie',
	spanProcessor: {
		factory: (exporter, config) => new BatchSpanProcessor(exporter, config),
	},
	rumAccessToken: undefined,
}

const INSTRUMENTATIONS = [
	{ Instrument: SplunkDocumentLoadInstrumentation, confKey: 'document', disable: false },
	{ Instrument: SplunkXhrPlugin, confKey: 'xhr', disable: false },
	{ Instrument: SplunkUserInteractionInstrumentation, confKey: 'interactions', disable: false },
	{ Instrument: SplunkPostDocLoadResourceInstrumentation, confKey: 'postload', disable: false },
	{ Instrument: SplunkFetchInstrumentation, confKey: 'fetch', disable: false },
	{ Instrument: SplunkWebSocketInstrumentation, confKey: 'websocket', disable: true },
	{ Instrument: SplunkLongTaskInstrumentation, confKey: 'longtask', disable: false },
	{ Instrument: SplunkErrorInstrumentation, confKey: ERROR_INSTRUMENTATION_NAME, disable: false },
	{ Instrument: SplunkPageVisibilityInstrumentation, confKey: 'visibility', disable: true },
	{ Instrument: SplunkConnectivityInstrumentation, confKey: 'connectivity', disable: true },
	{ Instrument: SplunkSocketIoClientInstrumentation, confKey: 'socketio', disable: true },
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
		url,
		otlp: options.exporter.otlp,
		onAttributesSerializing: options.exporter.onAttributesSerializing,
	})
}

class SessionSpanProcessor implements SpanProcessor {
	forceFlush(): Promise<void> {
		return Promise.resolve()
	}

	onEnd(): void {}

	onStart(): void {
		updateSessionStatus({
			forceStore: false,
			hadActivity: true,
		})
	}

	shutdown(): Promise<void> {
		return Promise.resolve()
	}
}

export interface SplunkOtelWebType extends SplunkOtelWebEventTarget {
	AlwaysOffSampler: typeof AlwaysOffSampler
	AlwaysOnSampler: typeof AlwaysOnSampler

	DEFAULT_AUTO_INSTRUMENTED_EVENTS: UserInteractionEventsConfig
	DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES: (keyof HTMLElementEventMap)[]

	ParentBasedSampler: typeof ParentBasedSampler
	SessionBasedSampler: typeof SessionBasedSampler

	/**
	 * Used internally by the SplunkSessionRecorder - checks if the current session is assigned to a correct recorder type.
	 */
	_internalCheckSessionRecorderType: (recorderType: RecorderType) => void

	/**
	 * Allows experimental options to be passed. No versioning guarantees are given for this method.
	 */
	_internalInit: (options: Partial<SplunkOtelWebConfigInternal>) => void

	/* Used internally by the SplunkSessionRecorder - span from session can extend the session */
	_internalOnExternalSpanCreated: () => void

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
	getSessionId: () => SessionId | undefined

	init: (options: SplunkOtelWebConfig) => void

	readonly inited: boolean

	isNewSessionId: () => boolean

	provider?: SplunkWebTracerProvider

	reportError: (error: string | Event | Error | ErrorEvent, context?: SpanContext) => void

	resource?: Resource

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

export const SplunkRum: SplunkOtelWebType = {
	DEFAULT_AUTO_INSTRUMENTED_EVENTS,
	DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES,

	// Re-export samplers as properties for easier use in CDN build
	AlwaysOnSampler,
	AlwaysOffSampler,
	ParentBasedSampler,
	SessionBasedSampler,

	get userTrackingMode() {
		return userTrackingMode
	},

	_processedOptions: null,

	get inited(): boolean {
		return inited
	},

	_internalInit: function (options: Partial<SplunkOtelWebConfigInternal>) {
		SplunkRum.init({
			...OPTIONS_DEFAULTS,
			...options,
		})
	},

	init: function (options) {
		userTrackingMode = options.user?.trackingMode ?? 'noTracking'

		if (typeof window !== 'object') {
			throw Error(
				'SplunkRum Error: This library is intended to run in a browser environment. Please ensure the code is evaluated within a browser context.',
			)
		}

		if (inited) {
			console.warn('SplunkRum already initialized.')
			return
		}

		// touches otel globals, our registerGlobal requires this first
		diag.setLogger(new DiagConsoleLogger(), options?.debug ? DiagLogLevel.DEBUG : DiagLogLevel.WARN)

		const registered = registerGlobal(this)
		if (!registered) {
			return
		}

		if (typeof Symbol !== 'function') {
			diag.error('SplunkRum: browser not supported, disabling instrumentation.')
			return
		}

		if (options.disableBots && isBot(navigator.userAgent)) {
			this.disabledByBotDetection = true
			diag.error('SplunkRum will not be initialized, bots are not allowed.')
			return
		}

		if (options.disableAutomationFrameworks && navigator.webdriver) {
			this.disabledByAutomationFrameworkDetection = true
			diag.error('SplunkRum will not be initialized, automation frameworks are not allowed.')
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
				`Invalid persistence flag: The value for "persistence" must be either "cookie", "localStorage", or omitted entirely, but was: ${processedOptions.persistence}`,
			)
			return
		}

		this._processedOptions = processedOptions

		if (processedOptions.realm) {
			if (!processedOptions.beaconEndpoint) {
				processedOptions.beaconEndpoint = getBeaconEndpointForRealm(processedOptions)
			} else {
				diag.warn('SplunkRum: Realm value ignored (beaconEndpoint has been specified)')
			}
		}

		if (!processedOptions.debug) {
			if (!processedOptions.beaconEndpoint) {
				throw new Error("SplunkRum.init( {beaconEndpoint: 'https://something'} ) is required.")
			} else if (!processedOptions.beaconEndpoint.startsWith('https') && !processedOptions.allowInsecureBeacon) {
				throw new Error('Not using https is unsafe, if you want to force it use allowInsecureBeacon option.')
			}

			if (!processedOptions.rumAccessToken) {
				diag.warn('rumAccessToken will be required in the future')
			}
		}

		const instanceId = generateId(64)

		const { ignoreUrls, applicationName, deploymentEnvironment, version } = processedOptions
		// enabled: false prevents registerInstrumentations from enabling instrumentations in constructor
		// they will be enabled in registerInstrumentations
		const pluginDefaults = { ignoreUrls, enabled: false }

		const resourceAttrs: ResourceAttributes = {
			...SDK_INFO,
			[SemanticResourceAttributes.TELEMETRY_SDK_NAME]: '@splunk/otel-web',
			[SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: VERSION,
			// Splunk specific attributes
			'splunk.rumVersion': VERSION,
			'splunk.scriptInstance': instanceId,
			'app': applicationName,
		}

		if (BrowserInstanceService.id) {
			resourceAttrs['browser.instance.id'] = BrowserInstanceService.id
		}

		const syntheticsRunId = getSyntheticsRunId()
		if (syntheticsRunId) {
			resourceAttrs[SYNTHETICS_RUN_ID_ATTRIBUTE] = syntheticsRunId
		}

		this.resource = new Resource(resourceAttrs)

		this.attributesProcessor = new SplunkSpanAttributesProcessor(
			{
				...(deploymentEnvironment
					? { 'environment': deploymentEnvironment, 'deployment.environment': deploymentEnvironment }
					: {}),
				...(version ? { 'app.version': version } : {}),
				...(processedOptions.globalAttributes || {}),
			},
			this._processedOptions.persistence === 'localStorage',
			() => userTrackingMode,
			processedOptions.cookieDomain,
		)

		const spanProcessors: SpanProcessor[] = [this.attributesProcessor]

		if (processedOptions.beaconEndpoint) {
			const exporter = buildExporter(processedOptions)
			const spanProcessor = processedOptions.spanProcessor.factory(exporter, {
				scheduledDelayMillis: processedOptions.bufferTimeout,
				maxExportBatchSize: processedOptions.bufferSize,
			})
			spanProcessors.push(spanProcessor)
			this._processor = spanProcessor
		}

		if (processedOptions.debug) {
			spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()))
		}

		if (options._experimental_allSpansExtendSession) {
			spanProcessors.push(new SessionSpanProcessor())
		}

		if (options.spanProcessors) {
			spanProcessors.push(...options.spanProcessors)
		}

		const provider = new SplunkWebTracerProvider({
			...processedOptions.tracer,
			resource: this.resource,
			sampler: new SplunkSamplerWrapper({
				decider: processedOptions.tracer?.sampler ?? new AlwaysOnSampler(),
				allSpansAreActivity: Boolean(this._processedOptions._experimental_allSpansExtendSession),
			}),
			spanProcessors,
		})

		_deinitSessionTracking = initSessionTracking(
			processedOptions.persistence,
			eventTarget,
			processedOptions.cookieDomain,
		).deinit

		const instrumentations = INSTRUMENTATIONS.map(({ Instrument, confKey, disable }) => {
			const pluginConf = getPluginConfig(processedOptions.instrumentations[confKey], pluginDefaults, disable)
			if (pluginConf) {
				const instrumentation =
					Instrument === SplunkLongTaskInstrumentation
						? new Instrument(pluginConf, options)
						: // @ts-expect-error - Find a better way to type it
							new Instrument(pluginConf)

				if (confKey === ERROR_INSTRUMENTATION_NAME && instrumentation instanceof SplunkErrorInstrumentation) {
					_errorInstrumentation = instrumentation
				}

				if (confKey === 'postload' && instrumentation instanceof SplunkPostDocLoadResourceInstrumentation) {
					_postDocLoadInstrumentation = instrumentation
				}

				return instrumentation
			}

			return null
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
				onBeforeContextStart: () => _postDocLoadInstrumentation?.onBeforeContextChange(),
				onBeforeContextEnd: () => _postDocLoadInstrumentation?.onBeforeContextChange(),
			}),
		})

		// After context manager registration so instrumentation event listeners are affected accordingly
		_deregisterInstrumentations = registerInstrumentations({
			tracerProvider: provider,
			instrumentations,
		})

		this.provider = provider

		const vitalsConf = getPluginConfig(processedOptions.instrumentations.webvitals)
		if (vitalsConf !== false) {
			initWebVitals(provider, vitalsConf)
		}

		inited = true
		diag.info('SplunkRum.init() complete')
	},

	deinit(force = false) {
		if (!inited && !force) {
			return
		}

		_deregisterInstrumentations?.()
		_deregisterInstrumentations = undefined

		_deinitSessionTracking?.()
		_deinitSessionTracking = undefined

		void this.provider?.shutdown()
		delete this.provider

		eventTarget = undefined

		diag.disable()
		unregisterGlobal()

		forgetAnonymousId()
		inited = false
	},

	setGlobalAttributes(this: SplunkOtelWebType, attributes?: Attributes) {
		this.attributesProcessor?.setGlobalAttributes(attributes)
		eventTarget?.emit('global-attributes-changed', {
			attributes: this.attributesProcessor?.getGlobalAttributes() || {},
		})
	},

	getGlobalAttributes(this: SplunkOtelWebType) {
		return this.attributesProcessor?.getGlobalAttributes() || {}
	},

	reportError(error: string | Event | Error | ErrorEvent, context: SpanContext = {}) {
		if (!inited) {
			diag.debug('SplunkRum not inited')
			return
		}

		if (!_errorInstrumentation) {
			diag.error('SplunkRum.reportError error was reported, but error instrumentation is disabled.')
			return
		}

		if (!error) {
			diag.warn('SplunkRum.reportError called with no argument - ignoring.')
			return
		}

		if (!_errorInstrumentation.isValidErrorArg(error)) {
			diag.warn(
				'SplunkRum.reportError called with invalid argument, ignoring. Expected string, Error, ErrorEvent or Event.',
			)
			return
		}

		const parsedAdditionalAttributes = getValidAttributes(context)
		_errorInstrumentation.report('SplunkRum.reportError', error, parsedAdditionalAttributes)
	},

	addEventListener(name, callback): void {
		eventTarget?.addEventListener(name, callback)
	},

	removeEventListener(name, callback): void {
		eventTarget?.removeEventListener(name, callback)
	},

	setUserTrackingMode(mode: UserTrackingMode) {
		userTrackingMode = mode
	},

	getAnonymousId() {
		if (!this._processedOptions) {
			return
		}

		if (userTrackingMode === 'anonymousTracking') {
			return getOrCreateAnonymousId({
				useLocalStorage: this._processedOptions.persistence === 'localStorage',
				domain: this._processedOptions.cookieDomain,
			})
		}
	},

	getSessionId() {
		if (!inited) {
			return undefined
		}

		return getRumSessionId()
	},
	isNewSessionId() {
		return getIsNewSession()
	},

	_internalOnExternalSpanCreated() {
		if (!this._processedOptions) {
			return
		}

		updateSessionStatus({
			forceStore: false,
			hadActivity: this._processedOptions._experimental_allSpansExtendSession,
		})
	},
	_internalCheckSessionRecorderType(recorderType: RecorderType) {
		checkSessionRecorderType(recorderType)
	},
}

export default SplunkRum
