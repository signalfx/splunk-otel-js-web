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
import { Recorder, RecorderConfig, RecorderEmitContext } from './recorder'
import { SessionReplayPlain as SessionReplayPlainType, SessionReplayPlainSegment } from '../session-replay'
import { SessionReplayPlain } from '../session-replay/loader'

export class ProprietaryRecorder extends Recorder {
	private sessionReplay: SessionReplayPlainType | undefined

	constructor(config: RecorderConfig) {
		super(config)

		if (SessionReplayPlain) {
			this.sessionReplay = new SessionReplayPlain({
				features: {
					//backgroundServiceSrc: SESSION_REPLAY_BACKGROUND_SERVICE_URL,
					cacheAssets: false,
					iframes: false,
					imageBitmap: false,
					packAssets: false,
				},
				logLevel: 'debug',
				maskAllInputs: false,
				maskAllText: false,
				maxExportIntervalMs: 5000,
				onSegment: this.onSegment,
			})
		} else {
			console.warn('SessionReplayPlain is not available. Proprietary recording is disabled.')
		}
	}

	static clear() {
		if (SessionReplayPlain) {
			console.log('ProprietaryRecorder: Clearing assets')
			SessionReplayPlain.clear()
		}
	}

	pause() {
		this.sessionReplay?.stop()
	}

	resume() {
		void this.sessionReplay?.start()
	}

	start() {
		void this.sessionReplay?.start()
	}

	stop() {
		this.sessionReplay?.stop()
	}

	private onSegment(segment: SessionReplayPlainSegment) {
		console.log('Session replay segment: ', segment)

		const context: RecorderEmitContext = {
			data: { data: segment.data, metadata: segment.metadata },
			onSessionChanged: this.onSessionChanged,
			startTime: segment.metadata.startUnixMs,
			type: 'proprietary',
		}

		this.onEmit(context)
	}

	private onSessionChanged() {
		console.log('ProprietaryRecorder: onSessionChanged')
		this.stop()
		ProprietaryRecorder.clear()
		this.start()
	}
}
