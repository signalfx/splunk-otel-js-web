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
export const isFormData = (maybeFormData: string | object | undefined | null): maybeFormData is FormData =>
	maybeFormData !== null && typeof maybeFormData === 'object' && maybeFormData.constructor.name === 'FormData'

export const isBlob = (maybeBlob: unknown): maybeBlob is Blob =>
	maybeBlob !== null && typeof maybeBlob === 'object' && maybeBlob.constructor.name === 'Blob'

export const isUint8Array = (maybeUint8Array: unknown): maybeUint8Array is Uint8Array =>
	maybeUint8Array !== null && typeof maybeUint8Array === 'object' && maybeUint8Array.constructor.name === 'Uint8Array'

export const isArrayBuffer = (maybeArrayBuffer: unknown): maybeArrayBuffer is ArrayBuffer =>
	maybeArrayBuffer !== null &&
	typeof maybeArrayBuffer === 'object' &&
	maybeArrayBuffer.constructor.name === 'ArrayBuffer'
