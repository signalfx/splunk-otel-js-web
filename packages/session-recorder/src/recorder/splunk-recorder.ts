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
import { RecorderBase, RecorderConfig, RecorderEmitContext } from './recorder-base'
import { SessionReplay, SessionReplayConfig, Segment } from '../session-replay'
import { log } from '../log'

export type SplunkRecorderPublicConfig = Omit<SessionReplayConfig, 'onSegment'>

type SplunkRecorderConfig = SplunkRecorderPublicConfig & RecorderConfig

export class SplunkRecorder extends RecorderBase {
	private isStoppedManually: boolean = true

	private isVisibilityListenerAttached: boolean = false

	private sessionReplay: SessionReplay

	constructor(private readonly config: SplunkRecorderConfig) {
		super(config)

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
			log.debug('SplunkRecorder: Clearing assets')
			SessionReplay.clear()
		}
	}

	onSessionChanged() {
		log.debug('SplunkRecorder: onSessionChanged')
		this.stop()
		SplunkRecorder.clear()
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
		}

		this.isStoppedManually = false
	}

	stop() {
		this.sessionReplay.stop()

		document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
		this.isVisibilityListenerAttached = false
		this.isStoppedManually = true
	}

	private onSegment = (segment: Segment) => {
		log.debug('Session replay segment: ', segment)

		const plainSegment = segment.toPlain()
		const context: RecorderEmitContext = {
			data: plainSegment,
			startTime: plainSegment.metadata.startUnixMs,
			type: 'splunk',
		}

		this.onEmit(context)
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
