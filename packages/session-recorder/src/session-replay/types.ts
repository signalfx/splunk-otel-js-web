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
interface SessionReplayClassBase {
	clear: () => void
}

interface SessionReplayBase {
	start: () => Promise<void>
	stop: () => void
}

export interface SessionReplayClass extends SessionReplayClassBase {
	compressData: (dataToCompress: ReadableStream<Uint8Array>, format: 'deflate' | 'gzip') => Promise<Blob>
	isCompressionSupported: () => Promise<boolean>
}

export interface SessionReplayPlainClass extends SessionReplayClassBase {
	new (config: SessionReplayConfig): SessionReplayPlainInstance
}

export type SessionReplayPlainInstance = SessionReplayBase

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

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
}

export interface SessionReplayPlainSegment {
	data: {
		assets: ProcessedAsset[]
		events: ReplayEvent[]
	}
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
