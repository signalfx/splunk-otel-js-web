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
declare module 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/v1.35.4/session-replay.module.legacy.min.js' {
	class SessionReplayBase {
		static clear: () => void

		start: () => Promise<void>

		stop: () => void
	}

	export class SessionReplay extends SessionReplayBase {
		constructor(config: SessionReplayConfig)

		static compressData: (dataToCompress: ReadableStream<Uint8Array>, format: 'deflate' | 'gzip') => Promise<Blob>

		static isCompressionSupported: () => Promise<boolean>
	}

	export class SessionReplayPlain extends SessionReplayBase {
		constructor(config: SessionReplayConfig & { onSegment: (segment: SessionReplayPlainSegment) => void })
	}

	type LogLevel = 'debug' | 'info' | 'warn' | 'error'

	export const SensitivityRuleTypesArray = ['mask', 'unmask', 'exclude'] as const
	export type SensitivityRuleType = (typeof SensitivityRuleTypesArray)[number]

	export interface SensitivityRule {
		rule: SensitivityRuleType
		selector: string
	}

	interface ConfigFeatures {
		backgroundServiceSrc?: string
		cacheAssets?: boolean
		iframes?: boolean
		imageBitmap?: boolean
		packAssets?: boolean
	}

	export interface SessionReplayConfig {
		features?: ConfigFeatures
		logLevel?: LogLevel
		maskAllInputs?: boolean
		maskAllText?: boolean
		maxExportIntervalMs?: number
		onSegment: (segment: SessionReplayPlainSegment) => void
		originalFetch?: typeof fetch
		sensitivityRules?: SensitivityRule[]
	}

	export interface SessionReplayPlainSegment {
		data: {
			assets: ProcessedAsset[]
			events: ReplayEvent[]
		}
		metadata: SessionReplayMetadata
	}

	export interface SessionReplayBinarySegment {
		data: Blob
		metadata: SessionReplayMetadata
	}

	interface SessionReplayMetadata {
		'browser.instance.id': string
		'endUnixMs': number
		'format': 'plain' | 'binary' | 'binary-deflate'
		'sdkVersion': string
		'source': 'web'
		'startUnixMs': number
		'synthetic'?: true
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
