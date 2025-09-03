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
import { context } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'

import { BatchLogProcessor, convert } from '../batch-log-processor'
import { SplunkRumRecorderConfig } from '../index'
import { log } from '../log'
import { Segment, SessionReplay, SessionReplayConfig } from './cdn-module'
import { getSplunkRecorderConfig } from './config'

const MAX_CHUNK_SIZE = 4000 * 1024 // ~4000 KB

const encoder = new TextEncoder()
const decoder = new TextDecoder()

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
	}: {
		initRecorderConfig: Omit<SplunkRumRecorderConfig, 'realm' | 'recorder' | 'rumAccessToken' | 'beaconEndpoint'>
		processor: BatchLogProcessor
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

		this.sessionReplay = new SessionReplay({
			features: {
				backgroundServiceSrc: this.config.features?.backgroundServiceSrc,
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

	onSessionChanged() {
		log.debug('Recorder: onSessionChanged')
		this.stop()
		Recorder.clear()
		this.start()
	}

	pause() {
		this.stop()
	}

	resume() {
		this.start()
	}

	start() {
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
		this.sessionReplay.stop()

		if (this.isVisibilityListenerAttached) {
			document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
			this.isVisibilityListenerAttached = false
		}

		this.isStoppedManually = true
	}

	private onEmit = (emitContext: RecorderEmitContext) => {
		const time = Math.floor(emitContext.startTime)
		const eventI = this.eventCounter

		this.eventCounter += 1

		const body = encoder.encode(JSON.stringify(emitContext.data.data))

		const totalC = Math.ceil(body.byteLength / MAX_CHUNK_SIZE)

		for (let i = 0; i < totalC; i++) {
			const start = i * MAX_CHUNK_SIZE
			const end = (i + 1) * MAX_CHUNK_SIZE

			const dataToConvert: Record<string, any> = {
				'rr-web.chunk': i + 1,
				'rr-web.event': eventI,
				'rr-web.offset': this.logCounter,
				'rr-web.total-chunks': totalC,
			}

			dataToConvert['segmentMetadata'] = JSON.stringify(emitContext.data.metadata)

			const logData = convert(decoder.decode(body.slice(start, end)), time, dataToConvert)

			this.logCounter += 1

			log.debug('Emitting log', logData)

			this.processor.onEmit(logData)
			void this.processor.forceFlush()
		}
	}

	private onSegment = (segment: Segment) => {
		log.debug('Session replay segment: ', segment)

		const plainSegment = segment.toPlain()

		this.onEmit({
			data: plainSegment,
			startTime: plainSegment.metadata.startUnixMs,
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
