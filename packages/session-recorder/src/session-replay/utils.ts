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
import { gzip } from 'fflate'

import { log } from '../log'
import { SessionReplay } from './cdn-module'

let isCompressionSupportedCache: boolean | undefined

export const isCompressionSupported = async () => {
	if (isCompressionSupportedCache !== undefined) {
		return isCompressionSupportedCache
	}

	// There is a library called response.js that overwrites Response object and use it for responsive design.
	// If customer uses this library we disable the compression since we do not have access to original Response object.
	// Fixes `Response is not a constructor` error.
	// See more at:
	// 	  https://github.com/ryanve/response.js
	// 	  https://github.com/ryanve/response.js/issues/76
	// Used for example on this page:
	//	  https://www.stanzeorsini.it/le-stanze/
	if (window.Response && 'dpr' in window.Response) {
		return false
	}

	if (window.CompressionStream === undefined) {
		return false
	}

	try {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				const encoder = new TextEncoder()
				controller.enqueue(encoder.encode('test'))
				controller.close()
			},
		})
		await compressData(stream, 'deflate')
	} catch {
		isCompressionSupportedCache = false
		return false
	}

	isCompressionSupportedCache = true
	return true
}

export const compressAsync = async (data: Uint8Array): Promise<Uint8Array | Blob> => {
	if (!SessionReplay) {
		log.warn('SessionReplay module undefined, fallback to gzip.')
		return compressGzipAsync(data)
	}

	const canUseCompression = await isCompressionSupported()
	if (!canUseCompression) {
		log.warn('Compression is not supported, fallback to gzip.')
		return compressGzipAsync(data)
	}

	const dataBlob = new Blob([data])
	return compressData(dataBlob.stream(), 'gzip')
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

const compressData = async (dataStream: ReadableStream<Uint8Array>, format: 'deflate' | 'gzip') => {
	const errorMessage = 'Compression'

	const processStream = new CompressionStream(format)
	const responsePipe = dataStream.pipeThrough(processStream)

	let processedBlob: Blob | undefined
	let numberOfRetries = 3
	while (numberOfRetries > 0) {
		try {
			const processedStreamResponse = new Response(responsePipe)
			processedBlob = await processedStreamResponse.blob()
			break
		} catch {
			// ignore Failed to fetch error
		} finally {
			numberOfRetries -= 1
		}
	}

	if (processedBlob === undefined) {
		throw new Error(`${errorMessage} failed`)
	}

	return processedBlob
}
