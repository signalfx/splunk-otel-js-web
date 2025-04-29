declare module 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/v1.33.0/session-replay.module.legacy.min.js' {
	class SessionReplayBase {
		start: () => Promise<void>
		stop: () => void
		static clear: () => void
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
