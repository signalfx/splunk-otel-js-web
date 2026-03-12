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
import { context } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'

import { BatchLogProcessor, convert } from '../batch-log-processor'
import { SplunkRumRecorderConfig } from '../index'
import { log } from '../log'
import { isBoolean, isString } from '../type-guards'
import { VERSION } from '../version'
import { Segment, SessionReplay, SessionReplayConfig } from './cdn-module'
import { getSplunkRecorderConfig } from './config'

const MAX_CHUNK_SIZE = 14_000 * 1024 // ~4000 KB

export interface RecorderEmitContext {
	data: Record<string, unknown>
	startTime: number
}

export type RecorderPublicConfig = Omit<SessionReplayConfig, 'onSegment'>

export class Recorder {
	private readonly config: RecorderPublicConfig & {
		originalFetch: (...args: Parameters<typeof fetch>) => Promise<Response>
	}

	private eventCounter = 1

	private isStoppedManually: boolean = true

	private isVisibilityListenerAttached: boolean = false

	private logCounter = 1

	private readonly processor: BatchLogProcessor

	private sessionReplay: SessionReplay

	constructor({
		initRecorderConfig,
		processor,
		sessionId,
	}: {
		initRecorderConfig: Omit<SplunkRumRecorderConfig, 'realm' | 'recorder' | 'rumAccessToken' | 'beaconEndpoint'>
		processor: BatchLogProcessor
		sessionId: string
	}) {
		this.processor = processor
		this.config = {
			originalFetch: (...args) =>
				new Promise((resolve, reject) => {
					context.with(suppressTracing(context.active()), () => {
						window
							.fetch(...args)
							.then(resolve)
							.catch(reject)
					})
				}),
			...getSplunkRecorderConfig(initRecorderConfig),
		}

		let backgroundServiceSrc = this.config.features?.backgroundServiceSrc
		const backgroundService = this.config.features?.backgroundService
		if (backgroundService !== undefined) {
			if (isBoolean(backgroundService)) {
				backgroundServiceSrc = backgroundService
					? `https://cdn.signalfx.com/o11y-gdi-rum/v${VERSION}/background-service.html`
					: undefined
			} else if (isString(backgroundService)) {
				backgroundServiceSrc = backgroundService
			}
		}

		this.sessionReplay = new SessionReplay({
			bindingKey: sessionId,
			features: {
				backgroundServiceSrc: backgroundServiceSrc,
				cacheAssets: this.config.features?.cacheAssets ?? false,
				canvas: this.config.features?.canvas ?? false,
				iframes: this.config.features?.iframes ?? false,
				packAssets: this.config.features?.packAssets ?? { styles: true },
				video: this.config.features?.video ?? false,
			},
			logLevel: this.config.logLevel ?? 'error',
			maskAllInputs: this.config.maskAllInputs ?? true,
			maskAllText: this.config.maskAllText ?? true,
			maxExportIntervalMs: this.config.maxExportIntervalMs ?? 5000,
			onSegment: this.onSegment,
			originalFetch: this.config.originalFetch,
			sensitivityRules: this.config.sensitivityRules ?? [],
		})
	}

	static clear() {
		if (SessionReplay) {
			log.debug('Recorder: Clearing assets')
			SessionReplay.clear()
		}
	}

	destroy() {
		log.debug('Recorder destroy')
		this.sessionReplay.destroy()
		Recorder.clear()
	}

	resume() {
		log.debug('Recorder resume')
		this.start()
	}

	start() {
		log.debug('Recorder started')
		if (document.visibilityState === 'visible') {
			void this.sessionReplay.start()
		}

		if (!this.isVisibilityListenerAttached) {
			document.addEventListener('visibilitychange', this.visibilityChangeHandler)
			this.isVisibilityListenerAttached = true
		}

		this.isStoppedManually = false
	}

	stop() {
		log.debug('Recorder stopped')
		this.sessionReplay.stop()

		if (this.isVisibilityListenerAttached) {
			document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
			this.isVisibilityListenerAttached = false
		}

		this.isStoppedManually = true
	}

	private onEmit = async (emitContext: RecorderEmitContext) => {
		console.log('🔥 dbg: onEmit emitContext', emitContext)

		const time = Math.floor(emitContext.startTime)
		const eventI = this.eventCounter

		this.eventCounter += 1

		const body = emitContext.data.data as Blob

		console.log('🔥 dbg: onEmit body', body)

		// for (let i = 0; i < totalC; i++) {
		// 	const start = i * MAX_CHUNK_SIZE
		// 	const end = (i + 1) * MAX_CHUNK_SIZE

		// 	console.log('🔥 dbg: onEmit start', start)
		// 	console.log('🔥 dbg: onEmit end', end)

		const dataToConvert: Record<string, any> = {
			'rr-web.chunk': 1,
			'rr-web.event': eventI,
			'rr-web.offset': this.logCounter,
			'rr-web.total-chunks': 1,
			'segmentMetadata': JSON.stringify(emitContext.data.metadata),
		}

		const arrayBuffer = await body.arrayBuffer()
		console.log('🔥 dbg: onEmit arrayBuffer', arrayBuffer)

		const logData = convert(new Uint8Array(arrayBuffer), time, dataToConvert)
		console.log('🔥 dbg: onEmit logData', logData)
		this.logCounter += 1

		log.debug('Emitting log', logData)

		this.processor.onEmit(logData)
		console.log('🔥 dbg: onEmit processor.onEmit', logData)
		void this.processor.forceFlush()
		// }
	}

	private onSegment = async (segment: Segment) => {
		log.debug('Session replay segment: ', segment)

		const binarySegment = await segment.toBinary()

		console.log('🔥 dbg: onSegment binarySegment', binarySegment)

		void this.onEmit({
			data: binarySegment,
			startTime: binarySegment.metadata.startUnixMs,
		})
	}

	private startOnVisibilityChange = () => {
		this.start()
	}

	private stopOnVisibilityChange = () => {
		this.sessionReplay.stop()
	}

	private visibilityChangeHandler = () => {
		if (document.visibilityState === 'visible') {
			if (!this.sessionReplay.isStarted && !this.isStoppedManually) {
				this.startOnVisibilityChange()
			}
		} else {
			if (this.sessionReplay.isStarted) {
				this.stopOnVisibilityChange()
			}
		}
	}
}
