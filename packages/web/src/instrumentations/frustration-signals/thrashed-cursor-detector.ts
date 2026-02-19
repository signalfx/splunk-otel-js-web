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

import { Tracer } from '@opentelemetry/api'

import { SplunkOtelWebConfig } from '../../types'

const DEFAULT_THRASHED_CURSOR_DISTANCE = 4000

export class ThrashedCursorDetector {
	private lastPosition: { x: number; y: number } | null = null

	private listener?: (event: MouseEvent) => void

	private totalDistanceTraveled = 0

	private constructor(
		private tracer: Tracer,
		private otelConfig: SplunkOtelWebConfig,
	) {}

	static create(tracer: Tracer, otelConfig: SplunkOtelWebConfig): ThrashedCursorDetector | undefined {
		if (!ThrashedCursorDetector.resolveEnabled(otelConfig)) {
			return undefined
		}

		return new ThrashedCursorDetector(tracer, otelConfig)
	}

	disable(): void {
		this.lastPosition = null
		this.totalDistanceTraveled = 0

		if (this.listener) {
			document.removeEventListener('mousemove', this.listener, true)
			this.listener = undefined
		}
	}

	enable(): void {
		if (this.listener) {
			return
		}

		this.listener = (event: MouseEvent) => {
			if (this.detectThrashedCursor(event.clientX, event.clientY)) {
				const startTime = Date.now()
				const span = this.tracer.startSpan('frustration', { startTime })
				span.setAttribute('frustration_type', 'thrash')
				span.setAttribute('interaction_type', 'cursor')
				span.setAttribute('component', 'user-interaction')
				span.end(startTime)
			}
		}
		document.addEventListener('mousemove', this.listener, true)
	}

	private static resolveEnabled(otelConfig: SplunkOtelWebConfig): boolean {
		const frustrationSignals = otelConfig.instrumentations?.frustrationSignals ?? {
			thrashedCursor: true,
		}

		if (frustrationSignals && typeof frustrationSignals === 'object') {
			return frustrationSignals.thrashedCursor !== false
		}

		return false
	}

	private detectThrashedCursor(x: number, y: number): boolean {
		if (this.lastPosition) {
			this.totalDistanceTraveled += Math.hypot(x - this.lastPosition.x, y - this.lastPosition.y)
		}

		this.lastPosition = { x, y }

		if (this.totalDistanceTraveled >= DEFAULT_THRASHED_CURSOR_DISTANCE) {
			this.totalDistanceTraveled = 0

			return true
		}

		return false
	}
}
