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

import { Attributes, Span, trace, Tracer } from '@opentelemetry/api'
import type { SplunkOtelWebType } from '@splunk/otel-web'
import { JsonObject } from 'type-fest'

import { isRecorderLoadedViaLatestTag, isRecorderLoadedViaNextTag } from './detect-latest'
import { log } from './log'
import OTLPLogExporter from './otlp-log-exporter'
import { Recorder, RecorderPublicConfig } from './session-replay'
import { getGlobal, getSplunkRumVersion, isDebugMode, parseVersion } from './utils'
import { VERSION } from './version'

declare const __COMMIT_HASH__: string

export type SplunkRumRecorderConfig = {
	/** Destination for the captured data */
	beaconEndpoint?: string

	/** Debug mode */
	debug?: boolean

	/**
	 * Enables persistence of session replay data when upload requests fail.
	 *
	 * When enabled, session replay chunks that fail to upload (due to network issues,
	 * server errors, or browser issues) are automatically stored in browser storage
	 * and retried on subsequent page loads.
	 *
	 * - `true` or `'localstorage'` (default): Failed chunks are queued in localStorage (2MB budget).
	 * - `'indexeddb'`: Failed OTLP log exports are queued in IndexedDB (100MB budget).
	 * - `false`: Disables persistence entirely.
	 * @default true
	 */
	persistFailedReplayData?: boolean | 'indexeddb' | 'localstorage'

	/**
	 * The name of your organization’s realm. Automatically configures beaconUrl with correct URL
	 */
	realm?: string

	/**
	 * RUM authorization token for data sending. Please make sure this is a token
	 * with only RUM scope as it's visible to every user of your app
	 **/
	rumAccessToken?: string

	/**
	 * Optional session sampler instance to control which sessions get recorded.
	 * Use SplunkRum.SessionBasedSampler to create one with a specific ratio.
	 * @example
	 * sampler: new SplunkRum.SessionBasedSampler({ ratio: 0.5 })
	 */
	sampler?: InstanceType<SplunkOtelWebType['SessionBasedSampler']>
} & RecorderPublicConfig

let inited: true | false | undefined = false
let tracer: Tracer
let sessionSampler: InstanceType<SplunkOtelWebType['SessionBasedSampler']> | undefined
let paused = false
let recorder: Recorder | undefined
let sessionStateUnsubscribe: undefined | (() => void)
let pendingSegmentsRetried = false
const isLatestTagUsed = isRecorderLoadedViaLatestTag()
const isNextTagUsed = isRecorderLoadedViaNextTag()

const useIndexedDBPersistence = (config: SplunkRumRecorderConfig): boolean =>
	config.persistFailedReplayData === 'indexeddb'

const retryPendingSegments = (recorderInstance: Recorder, sessionId: string) => {
	void recorderInstance.getPendingSegments().then((pendingSegments) => {
		log.debug('Retrying pending segments', pendingSegments.length, pendingSegments)
		for (const { bindingKey, segment, segmentId } of pendingSegments) {
			if (bindingKey !== sessionId) {
				void recorderInstance.dismissPendingSegment(segmentId)
				continue
			}

			const plainSegment = segment.toPlain()
			recorderInstance.emitPendingSegment(plainSegment, () => {
				void recorderInstance.dismissPendingSegment(segmentId)
			})
		}
	})
}

enum SpanName {
	IS_RECORDING = 'splunk.sessionReplay.isRecording',
	RESUME = 'splunk.sessionReplay.resume',
	STOP = 'splunk.sessionReplay.stop',
}

// Return span or undefined if session replay should not be recorded
const createSessionReplaySpanIfAllowed = (spanName: SpanName, sessionId: string | undefined): Span | undefined => {
	if (!tracer) {
		tracer = trace.getTracer('splunk.sessionReplay', VERSION)
	}

	// Check if session is managed by native SDK
	const SplunkRum = getGlobal<SplunkOtelWebType>()
	const sessionState = SplunkRum?.sessionManager?.getSessionState()
	if (sessionState?.source === 'external') {
		log.debug('Session replay span not created - recording is managed by native SDK', { sessionId, spanName })
		return
	}

	const now = Date.now()
	const span = tracer.startSpan(spanName.toString(), { startTime: now })
	span.setAttribute('splunk.sessionReplay', 'splunk')

	// Check if sampler is ignoring this
	if (!span.isRecording()) {
		return
	}

	if (!sessionId || (sessionSampler && !sessionSampler.isSessionSampled(sessionId))) {
		log.debug('Session sampler - session is not recorded', { sessionId })
		return
	} else {
		log.debug('Session sampler - session is recorded', { sessionId })
	}

	span.end(now)
	return span
}

const SplunkRumRecorder = {
	_getExporterForSession({
		anonymousUserId,
		attributes,
		exportQueuedLogs,
		exportUrl,
		persistFailedReplayData,
		sessionId,
	}: {
		anonymousUserId?: string
		attributes: Attributes
		exportQueuedLogs: boolean
		exportUrl: string
		persistFailedReplayData: boolean | 'indexeddb' | 'localstorage'
		sessionId: string
	}): OTLPLogExporter {
		const useLocalStorageQueue = persistFailedReplayData === true || persistFailedReplayData === 'localstorage'
		return new OTLPLogExporter({
			beaconUrl: exportUrl,
			exportQueuedLogs,
			getResourceAttributes() {
				const newAttributes: JsonObject = {
					...attributes,
					'splunk.rumSessionId': sessionId,
				}
				if (anonymousUserId) {
					newAttributes['user.anonymous_id'] = anonymousUserId
				}

				return newAttributes
			},
			sessionId,
			usePersistentExportQueue: useLocalStorageQueue,
		})
	},

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
			log.setLoggingLevel((config.debug ?? isDebugMode()) ? 'debug' : 'warn')
			if (typeof globalThis === 'undefined') {
				log.warn('[Splunk]: SplunkSessionRecorder is not supported in this browser.')
				return
			}

			if (isLatestTagUsed) {
				const { majorVersion } = parseVersion(VERSION)
				const newCdnBase = 'https://cdn.observability.splunkcloud.com/o11y-gdi-rum'

				log.warn(
					'[Splunk]: The "latest" CDN tag is deprecated and will remain pinned to v2.5.x — it will not receive new features or major updates. ' +
						'Please migrate to a versioned URL on the new CDN domain:\n' +
						`  - Major version lock (recommended): ${newCdnBase}/${majorVersion}/splunk-otel-web-session-recorder.js\n\n` +
						'The CDN domain is also changing from cdn.signalfx.com to cdn.observability.splunkcloud.com. ' +
						'If your application uses a Content Security Policy (CSP), update your script-src directive to allow the new domain.\n\n' +
						'See: https://quickdraw.splunk.com/redirect/?location=rum.browser.cdn&product=Observability&version=current',
				)
			}

			if (typeof window !== 'object') {
				log.warn(
					'[Splunk]: SplunkSessionRecorder.init() - Library requires browser environment. Ensure code runs in browser context.',
				)
				return
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

			const { beaconEndpoint, realm, rumAccessToken, sampler, ...initRecorderConfig } = config
			sessionSampler = sampler

			// Mark recorded session as splunk
			if (SplunkRum.provider) {
				SplunkRum.provider.resource.attributes['splunk.sessionReplay'] = 'splunk'

				if (isNextTagUsed && typeof __COMMIT_HASH__ === 'string' && __COMMIT_HASH__) {
					SplunkRum.provider.resource.attributes['splunk.rumVersionFullSessionRecorder'] = __COMMIT_HASH__
				}
			}

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

			sessionStateUnsubscribe = SplunkRum.sessionManager.subscribe(({ currentState, previousState }) => {
				if (!previousState) {
					return
				}

				if (
					currentState.state === 'expired-duration' ||
					(currentState.state === 'expired-inactivity' &&
						SplunkRum._processedOptions?._experimental_discardDataAfterInactivity)
				) {
					recorder?.stop()
					recorder?.destroy()
					recorder = undefined
					return
				}

				if (previousState.id !== currentState.id) {
					recorder?.stop()
					recorder?.destroy()
					recorder = undefined

					if (!createSessionReplaySpanIfAllowed(SpanName.IS_RECORDING, currentState.id)) {
						return
					}

					const persistSegments = useIndexedDBPersistence(config)
					recorder = new Recorder({
						exporter: this._getExporterForSession({
							anonymousUserId: SplunkRum.getAnonymousId(),
							attributes: resource.attributes,
							exportQueuedLogs: false,
							exportUrl,
							persistFailedReplayData: config.persistFailedReplayData ?? true,
							sessionId: currentState.id,
						}),
						initRecorderConfig,
						persistSegments,
						sessionId: currentState.id,
					})
					recorder.start()

					if (persistSegments && !pendingSegmentsRetried) {
						pendingSegmentsRetried = true
						retryPendingSegments(recorder, currentState.id)
					}
				}
			})

			const sessionId = SplunkRum.getSessionId()
			if (sessionId && createSessionReplaySpanIfAllowed(SpanName.IS_RECORDING, sessionId)) {
				const persistSegments = useIndexedDBPersistence(config)
				recorder = new Recorder({
					exporter: this._getExporterForSession({
						anonymousUserId: SplunkRum.getAnonymousId(),
						attributes: resource.attributes,
						exportQueuedLogs: true,
						exportUrl,
						persistFailedReplayData: config.persistFailedReplayData ?? true,
						sessionId,
					}),
					initRecorderConfig,
					persistSegments,
					sessionId,
				})
				recorder.start()

				if (persistSegments && !pendingSegmentsRetried) {
					pendingSegmentsRetried = true
					retryPendingSegments(recorder, sessionId)
				}
			}

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
				const SplunkRum = getGlobal<SplunkOtelWebType>()
				createSessionReplaySpanIfAllowed(SpanName.RESUME, SplunkRum?.getSessionId())
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
				const SplunkRum = getGlobal<SplunkOtelWebType>()
				createSessionReplaySpanIfAllowed(SpanName.STOP, SplunkRum?.getSessionId())
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
