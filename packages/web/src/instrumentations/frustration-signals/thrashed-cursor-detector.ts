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
import { isUrlIgnored } from '@opentelemetry/core'

import { SplunkOtelWebConfig } from '../../types'

// ============================================================================
// Types
// ============================================================================

export type ThrashedCursorOptions = Partial<ResolvedThrashedCursorConfig> | true

type ResolvedThrashedCursorConfig = {
	ignoreUrls: Array<string | RegExp>
	maxConfinedAreaSize: number
	maxVelocity: number
	minAverageVelocity: number
	minDirectionChangeDegrees: number
	minDirectionChanges: number
	minMovementDistance: number
	minTotalDistance: number
	scoreWeightConfinedArea: number
	scoreWeightDirectionChanges: number
	scoreWeightVelocity: number
	thrashingScoreThreshold: number
	throttleMs: number
	timeWindowMs: number
}

// ============================================================================
// Default configuration values
// ============================================================================

const DEFAULTS: ResolvedThrashedCursorConfig = {
	ignoreUrls: [],
	maxConfinedAreaSize: 200,
	maxVelocity: 5000,
	minAverageVelocity: 300,
	minDirectionChangeDegrees: 45,
	minDirectionChanges: 4,
	minMovementDistance: 5,
	minTotalDistance: 300,
	scoreWeightConfinedArea: 0.3,
	scoreWeightDirectionChanges: 0.4,
	scoreWeightVelocity: 0.3,
	thrashingScoreThreshold: 0.6,
	throttleMs: 16,
	timeWindowMs: 2000,
}

const MIN_THROTTLE_MS = 16

type Sample = {
	timestamp: number
	x: number
	y: number
}

type BoundingBoxResult = {
	height: number
	maxX: number
	maxY: number
	minX: number
	minY: number
	size: number
	width: number
}

type MetricsResult = {
	averageVelocity: number
	boundingBox: BoundingBoxResult
	directionChanges: number
	directionChangesPerSecond: number
	duration: number
	sampleCount: number
	totalDistance: number
}

type AnalysisResult = {
	isThrashing: boolean
	thrashingScore: number | undefined
}

// ============================================================================
// Detector class
// ============================================================================

export class ThrashedCursorDetector {
	/**
	 * Reusable result objects, mutated in place on each analysis pass.
	 *
	 * Performance: These objects are allocated once and reused across all
	 * mousemove events instead of creating new objects on each call.
	 * Since the analysis runs synchronously and results are consumed before
	 * the next event, there is no risk of data races.
	 */
	private readonly analysisResult: AnalysisResult = {
		isThrashing: false,
		thrashingScore: undefined,
	}

	private readonly boundingBoxResult: BoundingBoxResult = {
		height: 0,
		maxX: 0,
		maxY: 0,
		minX: 0,
		minY: 0,
		size: 0,
		width: 0,
	}

	/**
	 * Ring buffer capacity, computed from config at construction time.
	 * Sized to hold 2x the number of samples that fit in the analysis time window
	 * at the configured throttle rate, ensuring enough headroom for samples
	 * that haven't aged out yet.
	 */
	private readonly bufferCapacity: number

	/**
	 * Cached dead zone distance, scaled by devicePixelRatio.
	 * Movements smaller than this threshold are ignored to filter out noise/jitter.
	 * Computed once on enable() to avoid repeated multiplication on every sample.
	 */
	private cachedDeadZone = 0

	private hasLastMouse = false

	private lastMouseX = 0

	private lastMouseY = 0

	private lastSampleTime = 0

	private lastThrashingTime = -Infinity

	private listener?: (event: MouseEvent) => void

	private readonly metricsResult: MetricsResult = {
		averageVelocity: 0,
		boundingBox: this.boundingBoxResult,
		directionChanges: 0,
		directionChangesPerSecond: 0,
		duration: 0,
		sampleCount: 0,
		totalDistance: 0,
	}

	/**
	 * Pre-allocated fixed-size circular buffer for mouse position samples.
	 *
	 * Performance: Using a ring buffer instead of Array.push() + Array.filter()
	 * avoids per-event heap allocations and GC pressure. The mousemove handler
	 * can fire at ~60 events/sec, so eliminating object creation on each event
	 * prevents frequent minor GC pauses that could cause UI jank.
	 */
	private ringBuffer: Sample[] = []

	private sampleCount = 0

	private writeIndex = 0

	private constructor(
		private tracer: Tracer,
		private otelConfig: SplunkOtelWebConfig,
		private config: ResolvedThrashedCursorConfig,
	) {
		this.bufferCapacity = Math.ceil(config.timeWindowMs / config.throttleMs) * 2
	}

	static create(tracer: Tracer, otelConfig: SplunkOtelWebConfig): ThrashedCursorDetector | undefined {
		const config = ThrashedCursorDetector.resolveConfig(otelConfig)

		if (!config) {
			return undefined
		}

		return new ThrashedCursorDetector(tracer, otelConfig, config)
	}

	disable(): void {
		if (this.listener) {
			document.removeEventListener('mousemove', this.listener, true)
			this.listener = undefined
		}

		this.resetState()
	}

	enable(): void {
		if (this.listener) {
			return
		}

		this.cachedDeadZone = this.config.minMovementDistance * (window.devicePixelRatio || 1)
		this.initRingBuffer()

		this.listener = (event: MouseEvent) => {
			this.handleMouseMove(event)
		}
		document.addEventListener('mousemove', this.listener, true)
	}

	private static normalizeConfig(options: ThrashedCursorOptions): ResolvedThrashedCursorConfig {
		if (options === true) {
			return { ...DEFAULTS }
		}

		return {
			ignoreUrls: Array.isArray(options.ignoreUrls) ? options.ignoreUrls : DEFAULTS.ignoreUrls,
			maxConfinedAreaSize: resolveNumericOption(options.maxConfinedAreaSize, DEFAULTS.maxConfinedAreaSize),
			maxVelocity: resolveNumericOption(options.maxVelocity, DEFAULTS.maxVelocity),
			minAverageVelocity: resolveNumericOption(options.minAverageVelocity, DEFAULTS.minAverageVelocity),
			minDirectionChangeDegrees: resolveNumericOption(
				options.minDirectionChangeDegrees,
				DEFAULTS.minDirectionChangeDegrees,
			),
			minDirectionChanges: resolveNumericOption(options.minDirectionChanges, DEFAULTS.minDirectionChanges),
			minMovementDistance: resolveNumericOption(options.minMovementDistance, DEFAULTS.minMovementDistance),
			minTotalDistance: resolveNumericOption(options.minTotalDistance, DEFAULTS.minTotalDistance),
			scoreWeightConfinedArea: resolveNumericOption(
				options.scoreWeightConfinedArea,
				DEFAULTS.scoreWeightConfinedArea,
			),
			scoreWeightDirectionChanges: resolveNumericOption(
				options.scoreWeightDirectionChanges,
				DEFAULTS.scoreWeightDirectionChanges,
			),
			scoreWeightVelocity: resolveNumericOption(options.scoreWeightVelocity, DEFAULTS.scoreWeightVelocity),
			thrashingScoreThreshold: resolveNumericOption(
				options.thrashingScoreThreshold,
				DEFAULTS.thrashingScoreThreshold,
			),
			throttleMs: resolveNumericOption(options.throttleMs, DEFAULTS.throttleMs, MIN_THROTTLE_MS),
			timeWindowMs: resolveNumericOption(options.timeWindowMs, DEFAULTS.timeWindowMs),
		}
	}

	private static resolveConfig(otelConfig: SplunkOtelWebConfig): ResolvedThrashedCursorConfig | undefined {
		const frustrationSignals = otelConfig.instrumentations?.frustrationSignals

		if (frustrationSignals && typeof frustrationSignals === 'object') {
			const thrashedCursor = frustrationSignals.thrashedCursor

			if (typeof thrashedCursor === 'object' || thrashedCursor === true) {
				return ThrashedCursorDetector.normalizeConfig(thrashedCursor)
			}
		}

		return undefined
	}

	// ============================================================================
	// Ring buffer operations
	// ============================================================================

	private addSample(x: number, y: number, timestamp: number): void {
		const slot = this.ringBuffer[this.writeIndex]
		slot.x = x
		slot.y = y
		slot.timestamp = timestamp
		this.writeIndex = (this.writeIndex + 1) % this.bufferCapacity

		if (this.sampleCount < this.bufferCapacity) {
			this.sampleCount += 1
		}
	}

	/**
	 * Single-pass analysis over the ring buffer.
	 * Computes metrics, bounding box, and scoring without temporary allocations.
	 * Returns the reusable analysisResult (consumed synchronously by the caller
	 * before the next mousemove overwrites it).
	 */
	private analyzeThrashing(now: number): AnalysisResult {
		if (this.sampleCount < 3) {
			return this.setAnalysisResult(false, undefined)
		}

		if (now - this.lastThrashingTime < this.config.timeWindowMs) {
			return this.setAnalysisResult(false, undefined)
		}

		this.calculateMetrics(now)

		if (this.metricsResult.sampleCount < 3) {
			return this.setAnalysisResult(false, undefined)
		}

		if (this.metricsResult.totalDistance < this.config.minTotalDistance) {
			return this.setAnalysisResult(false, undefined)
		}

		if (this.metricsResult.averageVelocity < this.config.minAverageVelocity) {
			return this.setAnalysisResult(false, undefined)
		}

		if (this.metricsResult.directionChanges < this.config.minDirectionChanges) {
			return this.setAnalysisResult(false, undefined)
		}

		const thrashingScore = this.calculateThrashingScore()

		if (thrashingScore >= this.config.thrashingScoreThreshold) {
			return this.setAnalysisResult(true, thrashingScore)
		}

		return this.setAnalysisResult(false, thrashingScore)
	}

	/**
	 * Single-pass metrics and bounding box calculation over windowed ring buffer samples.
	 *
	 * Performance: computes distance, velocity, direction changes, and bounding box
	 * in a single iteration over the buffer instead of separate passes. This reduces
	 * the iteration count from 3-4x to 1x, which matters at ~60 calls/sec.
	 * Mutates metricsResult and boundingBoxResult in place (see reusable result objects).
	 */
	private calculateMetrics(now: number): void {
		const windowStart = now - this.config.timeWindowMs
		let totalDistance = 0
		let directionChanges = 0
		let lastDirection = -1
		let velocitySum = 0
		let velocityCount = 0
		let windowSampleCount = 0
		let firstTimestamp = 0
		let lastTimestamp = 0

		let minX = Infinity
		let maxX = -Infinity
		let minY = Infinity
		let maxY = -Infinity

		let prevX = 0
		let prevY = 0
		let prevTs = 0

		for (let i = 0; i < this.sampleCount; i += 1) {
			const s = this.ringBuffer[this.getSampleIndex(i)]

			if (s.timestamp < windowStart) {
				continue
			}

			windowSampleCount += 1

			if (s.x < minX) {
				minX = s.x
			}

			if (s.x > maxX) {
				maxX = s.x
			}

			if (s.y < minY) {
				minY = s.y
			}

			if (s.y > maxY) {
				maxY = s.y
			}

			if (windowSampleCount === 1) {
				firstTimestamp = s.timestamp
				lastTimestamp = s.timestamp
				prevX = s.x
				prevY = s.y
				prevTs = s.timestamp

				continue
			}

			lastTimestamp = s.timestamp

			const dist = distance(prevX, prevY, s.x, s.y)
			totalDistance += dist

			const timeDelta = (s.timestamp - prevTs) / 1000

			if (timeDelta > 0) {
				velocitySum += dist / timeDelta
				velocityCount += 1
			}

			if (dist > this.cachedDeadZone) {
				const direction = calculateAngle(prevX, prevY, s.x, s.y)

				if (lastDirection >= 0) {
					if (angleDifference(lastDirection, direction) >= this.config.minDirectionChangeDegrees) {
						directionChanges += 1
					}
				}

				lastDirection = direction
			}

			prevX = s.x
			prevY = s.y
			prevTs = s.timestamp
		}

		const duration = lastTimestamp - firstTimestamp

		this.metricsResult.sampleCount = windowSampleCount
		this.metricsResult.totalDistance = totalDistance
		this.metricsResult.directionChanges = directionChanges
		this.metricsResult.averageVelocity = velocityCount > 0 ? velocitySum / velocityCount : 0
		this.metricsResult.duration = duration
		this.metricsResult.directionChangesPerSecond = duration > 0 ? (directionChanges / duration) * 1000 : 0

		if (windowSampleCount > 0) {
			this.boundingBoxResult.minX = minX
			this.boundingBoxResult.maxX = maxX
			this.boundingBoxResult.minY = minY
			this.boundingBoxResult.maxY = maxY
			this.boundingBoxResult.width = maxX - minX
			this.boundingBoxResult.height = maxY - minY
			this.boundingBoxResult.size = Math.max(maxX - minX, maxY - minY)
		} else {
			this.boundingBoxResult.minX = 0
			this.boundingBoxResult.maxX = 0
			this.boundingBoxResult.minY = 0
			this.boundingBoxResult.maxY = 0
			this.boundingBoxResult.width = 0
			this.boundingBoxResult.height = 0
			this.boundingBoxResult.size = 0
		}
	}

	private calculateThrashingScore(): number {
		let score = 0

		const directionChangeRatio = Math.min(
			this.metricsResult.directionChanges / (this.config.minDirectionChanges * 2),
			1,
		)
		score += directionChangeRatio * this.config.scoreWeightDirectionChanges

		const velocityRatio = Math.max(
			0,
			Math.min(
				(this.metricsResult.averageVelocity - this.config.minAverageVelocity) / this.config.minAverageVelocity,
				1,
			),
		)
		score += velocityRatio * this.config.scoreWeightVelocity

		const boundingBoxSize = this.metricsResult.boundingBox.size || 0
		const confinementRatio = 1 / (1 + (boundingBoxSize / this.config.maxConfinedAreaSize) ** 2)
		score += confinementRatio * this.config.scoreWeightConfinedArea

		return Math.min(score, 1)
	}

	private getSampleIndex(i: number): number {
		if (this.sampleCount < this.bufferCapacity) {
			return i
		}

		return (this.writeIndex + i) % this.bufferCapacity
	}

	// ============================================================================
	// Event handling and span emission
	// ============================================================================

	private handleMouseMove(event: MouseEvent): void {
		const now = performance.now()

		if (this.config.throttleMs > 0 && now - this.lastSampleTime < this.config.throttleMs) {
			return
		}

		this.lastSampleTime = now

		const x = event.clientX
		const y = event.clientY

		if (this.hasLastMouse && this.sampleCount > 0) {
			const prevIdx = (this.writeIndex - 1 + this.bufferCapacity) % this.bufferCapacity
			const dist = distance(this.lastMouseX, this.lastMouseY, x, y)
			const timeDelta = (now - this.ringBuffer[prevIdx].timestamp) / 1000

			if (timeDelta > 0 && dist / timeDelta > this.config.maxVelocity) {
				this.lastMouseX = x
				this.lastMouseY = y

				return
			}
		}

		this.addSample(x, y, now)
		this.lastMouseX = x
		this.lastMouseY = y
		this.hasLastMouse = true

		const analysis = this.analyzeThrashing(now)

		if (analysis.isThrashing) {
			this.onThrashingDetected(analysis, now)
		}
	}

	private initRingBuffer(): void {
		this.ringBuffer = Array.from({ length: this.bufferCapacity }, () => ({ timestamp: 0, x: 0, y: 0 }))
		this.sampleCount = 0
		this.writeIndex = 0
	}

	private onThrashingDetected(analysis: AnalysisResult, _now: number): void {
		this.lastThrashingTime = _now

		if (isUrlIgnored(window.location.href, this.config.ignoreUrls)) {
			return
		}

		const patternDescription = getPatternDescription(this.metricsResult, this.config)

		const endTime = Date.now()
		const startTime = endTime - this.metricsResult.duration
		const span = this.tracer.startSpan('frustration', { startTime })
		span.setAttribute('frustration_type', 'thrash')
		span.setAttribute('interaction_type', 'cursor')
		span.setAttribute('component', 'user-interaction')
		span.setAttribute('thrashing_score', analysis.thrashingScore!)
		span.setAttribute('pattern_description', patternDescription)
		span.end(endTime)
	}

	private resetState(): void {
		this.sampleCount = 0
		this.writeIndex = 0
		this.lastMouseX = 0
		this.lastMouseY = 0
		this.hasLastMouse = false
		this.lastSampleTime = 0
		this.lastThrashingTime = -Infinity
		this.cachedDeadZone = 0
	}

	private setAnalysisResult(isThrashing: boolean, thrashingScore: number | undefined): AnalysisResult {
		this.analysisResult.isThrashing = isThrashing
		this.analysisResult.thrashingScore = thrashingScore

		return this.analysisResult
	}
}

// ============================================================================
// Pure math utilities (module-level for zero-cost reuse across instances)
// ============================================================================

const RADIANS_TO_DEGREES = 180 / Math.PI

function distance(x1: number, y1: number, x2: number, y2: number): number {
	return Math.hypot(x2 - x1, y2 - y1)
}

function calculateAngle(x1: number, y1: number, x2: number, y2: number): number {
	const degrees = Math.atan2(y2 - y1, x2 - x1) * RADIANS_TO_DEGREES

	return degrees >= 0 ? degrees : degrees + 360
}

function angleDifference(angle1: number, angle2: number): number {
	const diff = Math.abs(angle1 - angle2)

	return diff > 180 ? 360 - diff : diff
}

function getPatternDescription(metrics: MetricsResult, config: ResolvedThrashedCursorConfig): string {
	const parts: string[] = []

	const boundingBoxSize = metrics.boundingBox.size || 0
	const confinementRatio = 1 / (1 + (boundingBoxSize / config.maxConfinedAreaSize) ** 2)

	if (confinementRatio > 0.5) {
		parts.push('tightly confined')
	} else if (confinementRatio > 0.2) {
		parts.push('loosely confined')
	}

	if (metrics.directionChanges >= config.minDirectionChanges * 1.5) {
		parts.push('high direction changes')
	} else {
		parts.push('moderate direction changes')
	}

	if (metrics.averageVelocity >= config.minAverageVelocity * 1.5) {
		parts.push('fast movement')
	} else {
		parts.push('moderate speed')
	}

	const changeRate = metrics.directionChangesPerSecond

	if (changeRate > 10) {
		parts.push('very erratic')
	} else if (changeRate > 5) {
		parts.push('erratic')
	}

	return parts.join(', ')
}

/**
 * Validates a numeric config option, returning the default if the value
 * is not a number or is not greater than the minimum.
 */
function resolveNumericOption(val: number | undefined, def: number, min = 0): number {
	return typeof val === 'number' && val > min ? val : def
}
