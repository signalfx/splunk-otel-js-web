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
type ResponseTimingData = {
	fetchTotalMs: number
	finalRetries: number
}

type ResponseDebugData = {
	bodyUsed: boolean
	headers: Array<[string, string]> | undefined
	ok: boolean
	redirected: boolean
	type: string
	url: string
}

const getResponseDebugData = (response: Response): ResponseDebugData => ({
	type: response.type,
	bodyUsed: response.bodyUsed,
	headers: response.headers ? Array.from(response.headers as unknown as []) : undefined,
	ok: response.ok,
	redirected: response.redirected,
	url: response.url,
})

export class ApiError extends Error {
	readonly isOffline: boolean

	readonly isSignalAborted: boolean

	readonly name = 'ApiError'

	readonly responseDebugData: ResponseDebugData | undefined

	readonly visibilityState: DocumentVisibilityState

	readonly wasBeaconFallbackUsed: boolean

	get isConnectionError(): boolean {
		return this.status < 0 && !this.isAbortedByRecorder && !this.isAbortedByUserAgent
	}

	get isAbortedByRecorder(): boolean {
		return this.isSignalAborted
	}

	get isAbortedByUserAgent(): boolean {
		return this.originalError instanceof Error && this.originalError?.name === 'AbortError' && !this.isSignalAborted
	}

	constructor(
		message: string,
		readonly status: number,
		readonly responseTimingData: ResponseTimingData,
		signal: AbortSignal,
		readonly requestPayload: string,
		response?: Response,
		readonly originalError?: unknown,
		readonly responseData?: Record<string, unknown> | string | null,
		readonly additionalData?: Record<string, unknown>,
	) {
		super(message)

		// https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
		// Set the prototype explicitly.
		Object.setPrototypeOf(this, ApiError.prototype)

		this.responseDebugData = response ? getResponseDebugData(response) : undefined
		this.isSignalAborted = signal?.aborted
		this.visibilityState = document.visibilityState
		this.isOffline = navigator.onLine === false
		this.wasBeaconFallbackUsed = false
	}
}
