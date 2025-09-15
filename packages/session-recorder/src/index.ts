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
import type { Resource } from '@opentelemetry/resources'
import type { SplunkOtelWebType } from '@splunk/otel-web'
import { JsonObject } from 'type-fest'

import { BatchLogProcessor } from './batch-log-processor'
import { log } from './log'
import OTLPLogExporter from './otlp-log-exporter'
import { Recorder, RecorderPublicConfig } from './session-replay'
import { getGlobal, getSplunkRumVersion } from './utils'
import { VERSION } from './version'

interface BasicTracerProvider extends TracerProvider {
	readonly resource: Resource
}

export type SplunkRumRecorderConfig = {
	/** Destination for the captured data */
	beaconEndpoint?: string

	/** Debug mode */
	debug?: boolean

	/**
	 * Enables persistence of session replay data when upload requests fail.
	 *
	 * When enabled, session replay chunks that fail to upload (due to network issues,
	 * server errors, or browser issues) are automatically stored in local browser storage
	 * and retried on subsequent page loads.
	 *
	 * This feature helps prevent data loss and ensures comprehensive session coverage
	 * even in unreliable network conditions. The queue is automatically managed and
	 * cleaned up after successful uploads.
	 *
	 * Storage: Currently the data is stored in localStorage.
	 * @default true
	 */
	persistFailedReplayData?: boolean

	/**
	 * The name of your organization’s realm. Automatically configures beaconUrl with correct URL
	 */
	realm?: string

	/**
	 * RUM authorization token for data sending. Please make sure this is a token
	 * with only RUM scope as it's visible to every user of your app
	 **/
	rumAccessToken?: string
} & RecorderPublicConfig

let inited: true | false | undefined = false
let tracer: Tracer

let paused = false
let recorder: Recorder | undefined
let sessionStateUnsubscribe: undefined | (() => void)

const SplunkRumRecorder = {
	deinit(): void {
		if (!inited) {
			return
		}

		recorder?.stop()
		sessionStateUnsubscribe?.()
		inited = false
	},

	init(config: SplunkRumRecorderConfig): void {
		if (inited) {
			return
		}

		if (typeof window !== 'object') {
			throw new TypeError(
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

		const { beaconEndpoint, realm, rumAccessToken, ...initRecorderConfig } = config

		// Mark recorded session as splunk
		if (SplunkRum.provider) {
			SplunkRum.provider.resource.attributes['splunk.sessionReplay'] = 'splunk'
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
			if (exportUrl) {
				log.warn('SplunkSessionRecorder: Realm value ignored (beaconEndpoint has been specified)')
			} else {
				exportUrl = `https://rum-ingest.${realm}.signalfx.com/v1/rumreplay`
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
			usePersistentExportQueue: config.persistFailedReplayData ?? true,
		})
		const processor = new BatchLogProcessor(exporter)

		sessionStateUnsubscribe = SplunkRum.sessionManager.subscribe(({ currentState, previousState }) => {
			if (!previousState) {
				return
			}

			if (previousState.id !== currentState.id) {
				recorder?.stop()
				recorder = new Recorder({
					initRecorderConfig,
					processor,
				})
				recorder.start()
			}
		})

		try {
			recorder = new Recorder({
				initRecorderConfig,
				processor,
			})
			recorder.start()
			inited = true
		} catch (error) {
			log.error('SplunkSessionRecorder: Failed to initialize recorder', error)
		}
	},

	get inited(): boolean {
		return Boolean(inited)
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
}

export default SplunkRumRecorder
