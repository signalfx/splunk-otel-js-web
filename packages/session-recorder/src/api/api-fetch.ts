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
import { ApiError } from './api-error'
import { waitForOnline, createUrl, isTrustedEvent } from './utils'

type RequestInit = Parameters<typeof fetch>[1]

export type ApiParams = RequestInit & {
	abortPreviousRequest: boolean
	baseUrl?: string
	discardExistingPath?: boolean
	doNotConvert?: boolean
	doNotRetryOnDocumentHidden?: boolean
	logPayloadOnError?: boolean
	retryCount?: number
	retryInterval?: number
	retryOnHttpErrorStatusCodes?: boolean
	throwOnConvert?: boolean
	waitForOnlineStatus?: boolean
}

const defaultParams: Partial<RequestInit> = {
	headers: {},
}

const defaultHeaders = {
	// actually the payload is in most cases JSON,
	// but we use plain text so the preflight request is not send
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#simple_requests
	'Content-Type': 'text/plain;charset=UTF-8',
}

const abortControllersByUrl = new Map<string, AbortController>()

const ERROR_CODES_TO_RETRY = new Set([408, 429, 500, 502, 503, 504])

const MAX_HTTP_ERROR_RETRIES = 3

export const apiFetch = async <T>(
	pathName: string,
	{
		abortPreviousRequest,
		baseUrl,
		body,
		discardExistingPath,
		doNotConvert = false,
		doNotRetryOnDocumentHidden = false,
		headers,
		logPayloadOnError = false,
		retryCount = 3,
		retryInterval = 1000,
		retryOnHttpErrorStatusCodes = false,
		throwOnConvert = false,
		waitForOnlineStatus = false,
		...params
	}: ApiParams,
): Promise<{ data: T; response: Response }> => {
	const finalUrl = baseUrl
		? createUrl({ baseUrl, discardExistingPath, pathName })
		: new URL(pathName, window.location.origin)

	let abortController = abortControllersByUrl.get(finalUrl.href)

	if (abortController && abortPreviousRequest) {
		console.debug('Aborting previous request', finalUrl)
		abortController.abort('Aborted previous request.')
	}

	// cannot reuse old controller because signal could be already aborted
	abortController = new AbortController()
	abortControllersByUrl.set(finalUrl.href, abortController)

	const requestOptions = {
		...defaultParams,
		body,
		...params,
		signal: abortController.signal,
	}

	requestOptions.headers = headers === undefined ? defaultHeaders : headers

	let response: Response | undefined
	let responseData = null
	let fetchStart = performance.now()
	let fetchTotalMs = 0
	let finalRetries = -1
	let fetchError: Error | undefined

	for (let counter = 1; counter <= retryCount; counter++) {
		if (waitForOnlineStatus) {
			await waitForOnline()
		}

		finalRetries = counter
		try {
			if (counter === 1) {
				fetchStart = performance.now()
				response = await fetch(finalUrl.href, requestOptions)
			} else {
				const promises = []
				const timeoutPromise = new Promise<void>((resolve) => {
					setTimeout(
						() => {
							resolve()
						},
						retryInterval * Math.pow(2, counter - 1),
					)
				})

				promises.push(timeoutPromise)

				if (doNotRetryOnDocumentHidden) {
					const visibilityHiddenPromise = new Promise<void>((resolve) => {
						const visibilityChangeListener = (visibilityChangeEvent: Event) => {
							if (!isTrustedEvent(visibilityChangeEvent)) {
								return
							}

							if (document.visibilityState === 'hidden') {
								document.removeEventListener('visibilitychange', visibilityChangeListener)
								resolve()
							}
						}
						document.addEventListener('visibilitychange', visibilityChangeListener)

						if (document.visibilityState === 'hidden') {
							document.removeEventListener('visibilitychange', visibilityChangeListener)
							resolve()
						}
					})

					promises.push(visibilityHiddenPromise)
				}

				await Promise.race(promises)

				if (doNotRetryOnDocumentHidden && document.visibilityState === 'hidden') {
					// Gets caught locally and transformed to connection error
					throw new Error('Document is hidden and flag `doNotRetryOnDocumentHidden` is set to true.')
				}

				if (waitForOnlineStatus) {
					await waitForOnline()
				}

				fetchStart = performance.now()
				response = await fetch(finalUrl.href, requestOptions)
			}

			fetchError = undefined
		} catch (error) {
			fetchError = error as Error

			if (error instanceof Error && error.name === 'AbortError') {
				abortControllersByUrl.delete(finalUrl.href)
				throw new ApiError(
					'Request was aborted.',
					-1,
					{ fetchTotalMs, finalRetries },
					abortController.signal,
					logPayloadOnError ? JSON.stringify(body) : 'Payload not logged.',
					undefined,
					error,
				)
			}

			if (counter < retryCount && !(doNotRetryOnDocumentHidden && document.visibilityState === 'hidden')) {
				continue
			}
		} finally {
			fetchTotalMs = performance.now() - fetchStart
		}

		abortControllersByUrl.delete(finalUrl.href)

		if (!response) {
			throw new ApiError(
				`API request to ${finalUrl.href} failed due to connection error.`,
				-1,
				{
					fetchTotalMs,
					finalRetries,
				},
				abortController.signal,
				logPayloadOnError ? JSON.stringify(body) : 'Payload not logged.',
				undefined,
				fetchError,
			)
		}

		if (
			retryOnHttpErrorStatusCodes &&
			ERROR_CODES_TO_RETRY.has(response.status) &&
			counter < retryCount &&
			//! To ensure protection against self DDoS when the server is down, we have decided to allow a maximum of 3 retries for HTTP errors.
			counter < MAX_HTTP_ERROR_RETRIES
		) {
			continue
		}

		if (response.status > 399) {
			try {
				responseData = await response.json()
			} catch (error) {
				// Sometimes we receive `TypeError: failed to fetch` when converting response to json.
				// It happens when headers of response are received but connection dropped during receiving body.
				// When this happens we try to repeat the request.
				// More about this issue:
				//	https://stackoverflow.com/a/72038247/5594539
				if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TypeError')) {
					throw new ApiError(
						`API request to ${finalUrl.href} failed with status code ${response.status}.`,
						response.status,
						{ fetchTotalMs, finalRetries },
						abortController.signal,
						'Payload not logged.',
						response,
						error,
					)
				}
			}

			try {
				if (!responseData) {
					responseData = await response.text()
				}
			} catch (error) {
				// Sometimes we receive `TypeError: failed to fetch` when converting response to json.
				// It happens when headers of response are received but connection dropped during receiving body.
				// When this happens we try to repeat the request.
				// More about this issue:
				//	https://stackoverflow.com/a/72038247/5594539
				if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TypeError')) {
					throw new ApiError(
						`API request to ${finalUrl.href} failed with status code ${response.status}.`,
						response.status,
						{ fetchTotalMs, finalRetries },
						abortController.signal,
						'Payload not logged.',
						response,
						error,
					)
				}
			}

			throw new ApiError(
				`API request to ${finalUrl.href} failed with status code ${response.status}`,
				response.status,
				{ fetchTotalMs, finalRetries },
				abortController.signal,
				logPayloadOnError ? JSON.stringify(body) : 'Payload not logged.',
				response,
				undefined,
				{ responseData },
			)
		}

		if (response.status === 204) {
			break
		}

		if (doNotConvert) {
			break
		}

		try {
			responseData = await response.json()
			break
		} catch (error) {
			// Sometimes we receive `TypeError: failed to fetch` when converting response to json.
			// It happens when headers of response are received but connection dropped during receiving body.
			// When this happens we try to repeat the request.
			// More about this issue:
			//	https://stackoverflow.com/a/72038247/5594539
			if (
				error instanceof Error &&
				(error.name === 'AbortError' || error.name === 'TypeError') &&
				counter < retryCount
			) {
				continue
			}

			if (throwOnConvert && error instanceof Error) {
				const errorToThrow =
					error.name === 'AbortError' || error.name === 'TypeError'
						? new ApiError(
								`API request to ${finalUrl.href} failed due to connection error.`,
								-1,
								{
									fetchTotalMs,
									finalRetries,
								},
								abortController.signal,
								logPayloadOnError ? JSON.stringify(body) : 'Payload not logged.',
								undefined,
								fetchError,
							)
						: new Error(`Could not convert data to JSON in ${finalUrl.href} request`)
				throw errorToThrow
			} else if (throwOnConvert) {
				throw new Error(`Unknown error happened during API call. ${JSON.stringify(error)}`)
			} else {
				break
			}
		}
	}

	if (response === undefined) {
		throw new Error('Response object is undefined.')
	}

	return { data: responseData, response }
}
