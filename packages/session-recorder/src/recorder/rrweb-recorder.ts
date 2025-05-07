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
import { record } from 'rrweb'

import { Recorder, RecorderEmitContext, RecorderConfig } from './recorder'

export type RRWebRecorderPublicConfig = Parameters<typeof record>[0]

type RRWebRecorderConfig = RRWebRecorderPublicConfig & RecorderConfig

export class RRWebRecorder extends Recorder {
	private stopRecording: ReturnType<typeof record>

	constructor(private readonly config: RRWebRecorderConfig) {
		super(config)
	}

	pause() {}

	resume() {
		record.takeFullSnapshot()
	}

	start = () => {
		if (document.readyState === 'complete' || document.readyState === 'interactive') {
			this.startRecording()
		} else {
			window.addEventListener('load', this.startRecording, { once: true })
			this.stopRecording = () => window.removeEventListener('load', this.startRecording)
		}
	}

	stop() {
		if (this.stopRecording) {
			this.stopRecording()
		}
	}

	private startRecording = () => {
		this.stopRecording = record({
			maskAllInputs: true,
			maskTextSelector: '*',
			...this.config,
			emit: (event) => {
				const context: RecorderEmitContext = {
					type: 'rrweb',
					startTime: event.timestamp,
					data: event,
					onSessionChanged: () => {
						record.takeFullSnapshot()
					},
				}

				this.onEmit(context)
			},
		})
	}
}
