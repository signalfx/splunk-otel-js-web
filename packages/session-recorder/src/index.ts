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
import { isRecorderLoadedViaLatestTag } from './detect-latest'
import { log } from './log'
import OTLPLogExporter from './otlp-log-exporter'
import { Recorder, RecorderPublicConfig } from './session-replay'
import { getGlobal, getSplunkRumVersion, parseVersion } from './utils'
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
const isLatestTagUsed = isRecorderLoadedViaLatestTag()

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

		try {
			log.setLoggingLevel(config.debug ? 'debug' : 'warn')
			if (typeof globalThis === 'undefined') {
				log.warn('[Splunk]: SplunkSessionRecorder is not supported in this browser.')
				return
			}

			if (isLatestTagUsed) {
				const { exactVersion, majorVersion, minorVersion } = parseVersion(VERSION)
				const cdnBase = 'https://cdn.signalfx.com/o11y-gdi-rum'

				log.warn(
					'[Splunk]: You are using the "latest" version of splunk-otel-web-session-recorder.js. ' +
						'This automatically pulls the newest released version, which may introduce breaking changes without notice. ' +
						'This can cause unexpected behavior in production environments. ' +
						'Please use a version lock strategy instead:\n' +
						`  - Major version lock (recommended): ${cdnBase}/${majorVersion}/splunk-otel-web-session-recorder.js\n` +
						`  - Minor version lock:               ${cdnBase}/${minorVersion}/splunk-otel-web-session-recorder.js\n` +
						`  - Exact version lock:               ${cdnBase}/${exactVersion}/splunk-otel-web-session-recorder.js\n\n` +
						'See: https://quickdraw.splunk.com/redirect/?location=rum.browser.cdn&product=Observability&version=current',
				)
			}

			if (typeof window !== 'object') {
				log.warn(
					'[Splunk]: SplunkSessionRecorder.init() - Library requires browser environment. Ensure code runs in browser context.',
				)
				return
			}

			let tracerProvider: BasicTracerProvider | ProxyTracerProvider =
				trace.getTracerProvider() as BasicTracerProvider
			if (tracerProvider && 'getDelegate' in tracerProvider) {
				tracerProvider = (tracerProvider as unknown as ProxyTracerProvider).getDelegate() as BasicTracerProvider
			}

			const SplunkRum = getGlobal<SplunkOtelWebType>()
			if (!SplunkRum) {
				log.error(
					'[Splunk]: SplunkSessionRecorder.init() - SplunkRum must be initialized first. Call SplunkRum.init() before initializing session recorder.',
				)
				return
			}

			if (SplunkRum.disabledByBotDetection) {
				log.error('[Splunk]: SplunkSessionRecorder.init() - Session recording disabled due to bot detection.')
				return
			}

			if (SplunkRum.disabledByAutomationFrameworkDetection) {
				log.error(
					'[Splunk]: SplunkSessionRecorder.init() - Session recording disabled due to automation framework detection.',
				)
				return
			}

			const splunkRumVersion = getSplunkRumVersion()
			if (!splunkRumVersion || splunkRumVersion !== VERSION) {
				log.error(
					`[Splunk]: SplunkSessionRecorder.init() - Version mismatch detected. SplunkRum: ${splunkRumVersion ?? 'N/A'}, SplunkSessionRecorder: ${VERSION}. Ensure compatible versions are used.`,
				)
				return
			}

			if (!SplunkRum.resource || !SplunkRum.sessionManager) {
				log.error(
					'[Splunk]: SplunkSessionRecorder.init() - SplunkRum initialization incomplete. Resource and session manager are required.',
				)
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
					log.warn(
						'[Splunk]: SplunkSessionRecorder.init() - Realm value ignored because beaconEndpoint is already specified.',
					)
				} else {
					exportUrl = `https://rum-ingest.${realm}.signalfx.com/v1/rumreplay`
				}
			}

			if (!exportUrl) {
				log.error(
					'[Splunk]: SplunkSessionRecorder.init() - Cannot determine export URL. Specify either realm or beaconEndpoint in configuration.',
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

				if (currentState.state === 'expired-duration' && recorder) {
					recorder?.stop()
					recorder?.destroy()
					recorder = undefined
					return
				}

				if (previousState.id !== currentState.id) {
					recorder?.stop()
					recorder?.destroy()
					recorder = new Recorder({
						initRecorderConfig,
						processor,
					})
					recorder.start()
				}
			})

			recorder = new Recorder({
				initRecorderConfig,
				processor,
			})
			recorder.start()
			inited = true
		} catch (error) {
			log.error(
				'[Splunk]: SplunkSessionRecorder.init() - Failed to initialize session recorder. Check browser compatibility and permissions.',
				{ error },
			)
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
			try {
				void recorder?.resume()
				tracer.startSpan('record resume').end()
			} catch (error) {
				log.warn(
					'[Splunk]: SplunkSessionRecorder.resume() - Failed to resume recording session due to internal error.',
					{ error },
				)
			}
		}
	},

	stop(): void {
		if (!inited) {
			return
		}

		if (paused) {
			try {
				recorder?.stop()
				tracer.startSpan('record stop').end()
			} catch (error) {
				log.warn(
					'[Splunk]: SplunkSessionRecorder.stop() - Failed to stop recording session due to internal error.',
					{ error },
				)
			}
		}

		paused = true
	},
}

export default SplunkRumRecorder
