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
import { SessionReplay } from './cdn-module'
import { gzip } from 'fflate'

export const compressAsync = async (data: Uint8Array): Promise<Uint8Array | Blob> => {
	if (!SessionReplay) {
		console.warn('SessionReplay module undefined, fallback to gzip.')
		return compressGzipAsync(data)
	}

	const isCompressionSupported = await SessionReplay.isCompressionSupported()
	if (!isCompressionSupported) {
		console.warn('Compression is not supported, fallback to gzip.')
		return compressGzipAsync(data)
	}

	const dataBlob = new Blob([data])
	return SessionReplay.compressData(dataBlob.stream(), 'gzip')
}

const compressGzipAsync = async (data: Uint8Array): Promise<Uint8Array> =>
	new Promise<Uint8Array>((resolve, reject) => {
		gzip(data, (err, compressedData) => {
			if (err) {
				reject(err)
				return
			}

			resolve(compressedData)
		})
	})
