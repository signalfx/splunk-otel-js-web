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
declare module 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/v2.5.0/session-replay.module.legacy.min.js' {
	type DeepPartial<T> = {
		[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
	}

	type Modifiers = {
		omit: {
			css: boolean
			fonts: boolean
			images: boolean
		}
	}

	export type Stats = {
		assets: {
			binary: {
				css: number
				fonts: number
				images: number
				other: number
				total: number
			}
			plain: {
				css: number
				fonts: number
				images: number
				other: number
				total: number
			}
		}
	}

	export interface Segment {
		stats(): Stats
		toBinary(params?: DeepPartial<Modifiers>): SessionReplayBinarySegment
		toPlain(params?: DeepPartial<Modifiers>): SessionReplayPlainSegment
	}

	class SessionReplayBase {
		static clear: () => void

		destroy: () => void

		start: () => Promise<void>

		stop: () => void
	}

	export class SessionReplay extends SessionReplayBase {
		static loadPlainSegment: (segment: SessionReplayPlainSegment) => Segment

		readonly isStarted: boolean

		constructor(config: SessionReplayConfig & { onSegment: (segment: Segment) => void })
	}

	type LogLevel = 'debug' | 'info' | 'warn' | 'error'

	export const SensitivityRuleTypesArray = ['mask', 'unmask', 'exclude'] as const
	export type SensitivityRuleType = (typeof SensitivityRuleTypesArray)[number]

	export interface SensitivityRule {
		rule: SensitivityRuleType
		selector: string
	}

	export interface PackAssetsConfig {
		fonts?: boolean
		images?:
			| true
			| {
					readonly onlyViewportImages?: boolean
					readonly pack?: boolean
					readonly quality?: number
			  }
		styles?: boolean
	}

	export interface ConfigFeatures {
		backgroundServiceSrc?: string
		cacheAssets?: boolean
		canvas?: boolean
		iframes?: boolean
		packAssets?: boolean | PackAssetsConfig
		video?: boolean
	}

	export interface SessionReplayConfig {
		features?: ConfigFeatures
		logLevel?: LogLevel
		maskAllInputs?: boolean
		maskAllText?: boolean
		maxExportIntervalMs?: number
		onSegment: (segment: Segment) => void
		originalFetch?: typeof fetch
		sensitivityRules?: SensitivityRule[]
	}

	export interface SessionReplayPlainSegment extends Record<string, unknown> {
		data: {
			assets: ProcessedAsset[]
			events: ReplayEvent[]
		}
		metadata: SessionReplayMetadata
	}

	export interface SessionReplayBinarySegment extends Record<string, unknown> {
		data: Blob
		metadata: SessionReplayMetadata
	}

	interface SessionReplayMetadata {
		'browser.instance.id': string
		'endUnixMs': number
		'format': 'plain' | 'binary' | 'binary-deflate'
		'lastKnownSegmentEndUnixMs': number | null
		'sdkVersion': string
		'source': 'web'
		'startUnixMs': number
	}

	interface ReplayEvent {
		id: string
		name: string
		relativeTime: number
		timestamp: number
		windowId: number
	}

	type DataURL = `data:${string}`

	type AssetURI = `blob://${string}` | `http://${string}` | `https://${string}` | `blob:${string}`

	interface ProcessedAsset {
		content?: DataURL | Uint8Array
		mimetype?: string
		timestamp: number
		uri: AssetURI
	}
}
