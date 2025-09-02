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

import { ProxyTracerProvider, trace, Tracer, TracerProvider } from '@opentelemetry/api'
import OTLPLogExporter from './OTLPLogExporter'
import { BatchLogProcessor } from './BatchLogProcessor'
import { VERSION } from './version'
import { getGlobal, getSplunkRumVersion } from './utils'

import type { Resource } from '@opentelemetry/resources'
import type { SplunkOtelWebType } from '@splunk/otel-web'
import { JsonObject } from 'type-fest'

import { Recorder, RecorderType, RRWebRecorderPublicConfig, SplunkRecorderPublicConfig } from './recorder'
import { log } from './log'

interface BasicTracerProvider extends TracerProvider {
	readonly resource: Resource
}

export type SplunkRumRecorderConfig = {
	/** Destination for the captured data */
	beaconEndpoint?: string

	/** Debug mode */
	debug?: boolean

	/**
	 * The name of your organization’s realm. Automatically configures beaconUrl with correct URL
	 */
	realm?: string

	/** Type of the recorder */
	recorder?: RecorderType

	/**
	 * RUM authorization token for data sending. Please make sure this is a token
	 * with only RUM scope as it's visible to every user of your app
	 **/
	rumAccessToken?: string
} & RRWebRecorderPublicConfig &
	SplunkRecorderPublicConfig

let inited: true | false | undefined = false
let tracer: Tracer

let paused = false
let recorder: Recorder | undefined
let sessionStateUnsubscribe: undefined | (() => void)

const SplunkRumRecorder = {
	get inited(): boolean {
		return Boolean(inited)
	},

	init(config: SplunkRumRecorderConfig): void {
		if (inited) {
			return
		}

		if (typeof window !== 'object') {
			throw Error(
				'SplunkSessionRecorder Error: This library is intended to run in a browser environment. Please ensure the code is evaluated within a browser context.',
			)
		}

		log.setLoggingLevel(config.debug ? 'debug' : 'warn')

		let tracerProvider: BasicTracerProvider | ProxyTracerProvider = trace.getTracerProvider() as BasicTracerProvider
		if (tracerProvider && 'getDelegate' in tracerProvider) {
			tracerProvider = (tracerProvider as unknown as ProxyTracerProvider).getDelegate() as BasicTracerProvider
		}

		const SplunkRum = getGlobal<SplunkOtelWebType>()
		if (!SplunkRum) {
			log.error('SplunkRum must be initialized before session recorder.')
			return
		}

		if (SplunkRum.disabledByBotDetection) {
			log.error('SplunkSessionRecorder will not be initialized, bots are not allowed.')
			return
		}

		if (SplunkRum.disabledByAutomationFrameworkDetection) {
			log.error('SplunkSessionRecorder will not be initialized, automation frameworks are not allowed.')
			return
		}

		const splunkRumVersion = getSplunkRumVersion()
		if (!splunkRumVersion || splunkRumVersion !== VERSION) {
			log.error(
				`SplunkSessionRecorder will not be initialized. Version mismatch with SplunkRum (SplunkRum: ${splunkRumVersion ?? 'N/A'}, SplunkSessionRecorder: ${VERSION})`,
			)
			return
		}

		if (!SplunkRum.resource || !SplunkRum.sessionManager) {
			log.error('Splunk OTEL Web must be initialized before session recorder.')
			return
		}

		const resource = SplunkRum.resource

		const {
			beaconEndpoint,
			realm,
			rumAccessToken,
			recorder: recorderType = 'rrweb',
			...initRecorderConfig
		} = config
		const isSplunkRecorder = recorderType === 'splunk'

		if (recorderType === 'rrweb' && SplunkRum.userTrackingMode === 'anonymousTracking') {
			log.error(
				'SplunkSessionRecorder: Using rrweb recorder with anonymous tracking mode is not supported. Please use splunk recorder instead. Session recording will not be initialized.',
			)
			return
		}

		// TODO: Handle recorder type change (splunk -> rrweb or rrweb -> splunk)
		// SplunkRum._internalCheckSessionRecorderType(recorderType)

		// Mark recorded session as splunk
		if (SplunkRum.provider) {
			const sessionReplayAttribute = isSplunkRecorder ? 'splunk' : 'rrweb'
			SplunkRum.provider.resource.attributes['splunk.sessionReplay'] = sessionReplayAttribute
			log.debug(
				`SplunkSessionRecorder: splunk.sessionReplay resource attribute set to '${sessionReplayAttribute}'.`,
			)
		}

		tracer = trace.getTracer('splunk.rr-web', VERSION)
		const span = tracer.startSpan('record init')

		// Check if sampler is ignoring this
		if (!span.isRecording()) {
			return
		}

		span.end()

		let exportUrl = beaconEndpoint
		if (realm) {
			if (!exportUrl) {
				exportUrl = `https://rum-ingest.${realm}.signalfx.com/v1/rumreplay`
			} else {
				log.warn('SplunkSessionRecorder: Realm value ignored (beaconEndpoint has been specified)')
			}
		}

		if (!exportUrl) {
			log.error(
				'SplunkSessionRecorder could not determine `exportUrl`, please ensure that `realm` or `beaconEndpoint` is specified and try again',
			)
			return
		}

		if (rumAccessToken) {
			exportUrl += `?auth=${rumAccessToken}`
		}

		const exporter = new OTLPLogExporter({
			beaconUrl: exportUrl,
			getResourceAttributes() {
				const newAttributes: JsonObject = {
					...resource.attributes,
					'splunk.rumSessionId': SplunkRum.getSessionId() ?? '',
				}
				const anonymousId = SplunkRum.getAnonymousId()
				if (anonymousId) {
					newAttributes['user.anonymous_id'] = anonymousId
				}

				return newAttributes
			},
			sessionId: SplunkRum.getSessionId() ?? '',
			usePersistentExportQueue: isSplunkRecorder,
		})
		const processor = new BatchLogProcessor(exporter)

		sessionStateUnsubscribe = SplunkRum.sessionManager.subscribe(({ previousState, currentState }) => {
			if (!previousState) {
				return
			}

			if (previousState.id !== currentState.id) {
				recorder?.stop()
				recorder = new Recorder({
					initRecorderConfig,
					isSplunkRecorder,
					processor,
				})
				recorder.start()
			}
		})

		try {
			recorder = new Recorder({
				initRecorderConfig,
				isSplunkRecorder,
				processor,
			})
			recorder.start()
			inited = true
		} catch (error) {
			log.error('SplunkSessionRecorder: Failed to initialize recorder', error)
		}
	},

	resume(): void {
		if (!inited) {
			return
		}

		const oldPaused = paused
		paused = false
		if (!oldPaused) {
			void recorder?.resume()
			tracer.startSpan('record resume').end()
		}
	},
	stop(): void {
		if (!inited) {
			return
		}

		if (paused) {
			recorder?.stop()
			tracer.startSpan('record stop').end()
		}

		paused = true
	},
	deinit(): void {
		if (!inited) {
			return
		}

		recorder?.stop()
		sessionStateUnsubscribe?.()
		inited = false
	},
}

export default SplunkRumRecorder
