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

import { ProxyTracerProvider, TracerProvider, trace, Tracer } from '@opentelemetry/api'
import OTLPLogExporter from './OTLPLogExporter'
import { BatchLogProcessor, convert } from './BatchLogProcessor'
import { VERSION } from './version'
import { getSplunkRumVersion, getGlobal } from './utils'

import type { Resource } from '@opentelemetry/resources'
import type { SplunkOtelWebType } from '@splunk/otel-web'

import {
	Recorder,
	ProprietaryRecorder,
	RRWebRecorder,
	RecorderEmitContext,
	RRWebRecorderPublicConfig,
	ProprietaryRecorderPublicConfig,
	migrateRRWebConfigToProprietary,
} from './recorder'

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
	recorder?: 'rrweb' | 'proprietary'

	/**
	 * RUM authorization token for data sending. Please make sure this is a token
	 * with only RUM scope as it's visible to every user of your app
	 **/
	rumAccessToken?: string
} & RRWebRecorderPublicConfig &
	ProprietaryRecorderPublicConfig

// Hard limit of 4 hours of maximum recording during one session
const MAX_RECORDING_LENGTH = (4 * 60 + 1) * 60 * 1000
const MAX_CHUNK_SIZE = 950 * 1024 // ~950KB
const encoder = new TextEncoder()
const decoder = new TextDecoder()

let inited: true | false | undefined = false
let tracer: Tracer
let lastKnownSession: string | undefined
let sessionStartTime = 0
let paused = false
let eventCounter = 1
let logCounter = 1

let recorder: Recorder | undefined

const SplunkRumRecorder = {
	get inited(): boolean {
		return Boolean(inited)
	},

	init(config: SplunkRumRecorderConfig): void {
		if (inited) {
			return
		}

		if (typeof window === 'undefined') {
			console.error("SplunkSessionRecorder can't be run in non-browser environments.")
			return
		}

		let tracerProvider: BasicTracerProvider | ProxyTracerProvider = trace.getTracerProvider() as BasicTracerProvider
		if (tracerProvider && 'getDelegate' in tracerProvider) {
			tracerProvider = (tracerProvider as unknown as ProxyTracerProvider).getDelegate() as BasicTracerProvider
		}

		const SplunkRum = getGlobal<SplunkOtelWebType>()
		if (!SplunkRum) {
			console.error('SplunkRum must be initialized before session recorder.')
			return
		}

		if (SplunkRum.disabledByBotDetection) {
			console.error('SplunkSessionRecorder will not be initialized, bots are not allowed.')
			return
		}

		if (SplunkRum.disabledByAutomationFrameworkDetection) {
			console.error('SplunkSessionRecorder will not be initialized, automation frameworks are not allowed.')
			return
		}

		const splunkRumVersion = getSplunkRumVersion()
		if (!splunkRumVersion || splunkRumVersion !== VERSION) {
			console.error(
				`SplunkSessionRecorder will not be initialized. Version mismatch with SplunkRum (SplunkRum: ${splunkRumVersion ?? 'N/A'}, SplunkSessionRecorder: ${VERSION})`,
			)
			return
		}

		if (!SplunkRum.resource) {
			console.error('Splunk OTEL Web must be initialized before session recorder.')
			return
		}

		const resource = SplunkRum.resource

		const { beaconEndpoint, debug, realm, rumAccessToken, recorder: recorderType, ...initRecorderConfig } = config
		const isProprietaryRecorder = recorderType === 'proprietary'

		// Mark recorded session as proprietary
		if (isProprietaryRecorder && SplunkRum.provider) {
			SplunkRum.provider.resource.attributes['splunk.sessionReplay'] = 'proprietary'
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
				console.warn('SplunkSessionRecorder: Realm value ignored (beaconEndpoint has been specified)')
			}
		}

		if (!exportUrl) {
			console.error(
				'SplunkSessionRecorder could not determine `exportUrl`, please ensure that `realm` or `beaconEndpoint` is specified and try again',
			)
			return
		}

		if (rumAccessToken) {
			exportUrl += `?auth=${rumAccessToken}`
		}

		const exporter = new OTLPLogExporter({
			beaconUrl: exportUrl,
			debug,
			getResourceAttributes() {
				return {
					...resource.attributes,
					'splunk.rumSessionId': SplunkRum.getSessionId() ?? '',
				}
			},
			sessionId: SplunkRum.getSessionId() ?? '',
			usePersistentExportQueue: isProprietaryRecorder,
		})
		const processor = new BatchLogProcessor(exporter)

		lastKnownSession = SplunkRum.getSessionId()

		if (isProprietaryRecorder && SplunkRum.isNewSessionId()) {
			console.log('SplunkRum.isNewSessionId()')
			ProprietaryRecorder.clear()
		}

		sessionStartTime = Date.now()

		const onEmit = (context: RecorderEmitContext) => {
			if (paused) {
				return
			}

			let isExtended = false

			// Safeguards from our ingest getting DDOSed:
			// 1. A session can send up to 4 hours of data
			// 2. Recording resumes on session change if it isn't a background tab (session regenerated in an another tab)
			if (SplunkRum.getSessionId() !== lastKnownSession) {
				if (document.hidden) {
					return
				}

				// We need to call it here before another getSessionID call. This will create a new session
				// if the previous one was expired
				if (SplunkRum._internalOnExternalSpanCreated) {
					SplunkRum._internalOnExternalSpanCreated()
					isExtended = true
				}

				lastKnownSession = SplunkRum.getSessionId()
				sessionStartTime = Date.now()
				// reset counters
				eventCounter = 1
				logCounter = 1
				context.onSessionChanged()
			}

			if (context.startTime > sessionStartTime + MAX_RECORDING_LENGTH) {
				return
			}

			if (!isExtended) {
				if (SplunkRum._internalOnExternalSpanCreated) {
					SplunkRum._internalOnExternalSpanCreated()
				}
			}

			const time = context.type === 'proprietary' ? Math.floor(context.startTime) : context.startTime
			const eventI = eventCounter

			eventCounter += 1

			const body = encoder.encode(JSON.stringify(context.data))
			const totalC = Math.ceil(body.byteLength / MAX_CHUNK_SIZE)

			console.log('TotalC:', totalC)

			for (let i = 0; i < totalC; i++) {
				const start = i * MAX_CHUNK_SIZE
				const end = (i + 1) * MAX_CHUNK_SIZE
				const log = convert(decoder.decode(body.slice(start, end)), time, {
					'rr-web.offset': logCounter,
					'rr-web.event': eventI,
					'rr-web.chunk': i + 1,
					'rr-web.total-chunks': totalC,
				})

				logCounter += 1

				if (debug) {
					console.log(log)
				}

				processor.onEmit(log)
			}
		}

		recorder = isProprietaryRecorder
			? new ProprietaryRecorder({ ...migrateRRWebConfigToProprietary(initRecorderConfig), onEmit })
			: new RRWebRecorder({ ...initRecorderConfig, onEmit })
		recorder.start()
		inited = true
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
		inited = false
	},
}

export default SplunkRumRecorder
