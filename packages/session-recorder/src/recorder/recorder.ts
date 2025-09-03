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
import { SplunkRecorder } from './splunk-recorder'
import { context } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'
import { getSplunkRecorderConfig } from './config'
import { RRWebRecorder } from './rrweb-recorder'
import { RecorderBase, RecorderEmitContext } from './recorder-base'
import { SplunkRumRecorderConfig } from '../index'
import { log } from '../log'
import { BatchLogProcessor, convert } from '../BatchLogProcessor'

// TODO: When backend is deployed, also remove data splitting
// const MAX_CHUNK_SIZE = 4000 * 1024 // ~4000 KB
const MAX_CHUNK_SIZE = 950 * 1024 // ~950 KB

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class Recorder {
	private eventCounter = 1

	private readonly isSplunkRecorder: boolean

	private logCounter = 1

	private readonly processor: BatchLogProcessor

	private readonly recorder: RecorderBase

	constructor({
		initRecorderConfig,
		isSplunkRecorder,
		processor,
	}: {
		initRecorderConfig: Omit<SplunkRumRecorderConfig, 'realm' | 'recorder' | 'rumAccessToken' | 'beaconEndpoint'>
		isSplunkRecorder: boolean
		processor: BatchLogProcessor
	}) {
		this.isSplunkRecorder = isSplunkRecorder
		this.processor = processor
		this.recorder = isSplunkRecorder
			? new SplunkRecorder({
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
					onEmit: this.onEmit,
				})
			: new RRWebRecorder({ ...initRecorderConfig, onEmit: this.onEmit })
	}

	resume() {
		this.recorder.resume()
	}

	start() {
		this.recorder.start()
	}

	stop() {
		this.recorder.start()
	}

	private onEmit = (emitContext: RecorderEmitContext) => {
		const time = emitContext.type === 'splunk' ? Math.floor(emitContext.startTime) : emitContext.startTime
		const eventI = this.eventCounter

		this.eventCounter += 1

		const body = encoder.encode(
			JSON.stringify(emitContext.type === 'splunk' ? emitContext.data.data : emitContext.data),
		)

		const totalC = Math.ceil(body.byteLength / MAX_CHUNK_SIZE)

		for (let i = 0; i < totalC; i++) {
			const start = i * MAX_CHUNK_SIZE
			const end = (i + 1) * MAX_CHUNK_SIZE

			const dataToConvert: Record<string, any> = {
				'rr-web.offset': this.logCounter,
				'rr-web.event': eventI,
				'rr-web.chunk': i + 1,
				'rr-web.total-chunks': totalC,
			}

			if (emitContext.type === 'splunk') {
				dataToConvert['segmentMetadata'] = JSON.stringify(emitContext.data.metadata)
			}

			const logData = convert(decoder.decode(body.slice(start, end)), time, dataToConvert)

			this.logCounter += 1

			log.debug('Emitting log', logData)

			this.processor.onEmit(logData)
			if (this.isSplunkRecorder) {
				void this.processor.forceFlush()
			}
		}
	}
}
