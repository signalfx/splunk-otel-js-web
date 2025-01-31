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
export const isTrustedEvent = (eventToCheck: Event): boolean => {
	// Some old browsers do not have this property
	// See more at:
	// 	https://caniuse.com/?search=isTrusted
	if (eventToCheck.isTrusted === undefined) {
		return true
	}

	return eventToCheck.isTrusted
}

export const waitForOnline = async (): Promise<void> => {
	if (!navigator.onLine) {
		await new Promise<void>((resolve) => {
			const handleOnline = () => {
				window.removeEventListener('online', handleOnline)
				resolve()
			}

			window.addEventListener('online', handleOnline)

			if (navigator.onLine) {
				resolve()
				window.removeEventListener('online', handleOnline)
			}
		})
	}
}

const getBaseUrlWithPrefix = (baseUrl: string): string =>
	/^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`

export const createUrl = ({
	baseUrl,
	discardExistingPath,
	pathName,
}: {
	baseUrl: string
	discardExistingPath?: boolean
	pathName?: string
}): URL => {
	const baseUrlWithPrefix = new URL(getBaseUrlWithPrefix(baseUrl))

	if (!pathName) {
		return baseUrlWithPrefix
	}

	/**
	 * Appends path to origin discarding any existing path.
	 * Example: url: 'https://domain.com/v2', path: '/v1/logs', result: 'https://domain.com/v1/logs'
	 * Example: url: 'https://domain.com', path: '/v1/logs', result: 'https://domain.com/v1/logs'
	 * Example: url: 'https://domain.com/test', path: 'v1/logs', result: 'https://domain.com/v1/logs'
	 */
	if (discardExistingPath) {
		return new URL(pathName, baseUrlWithPrefix.origin)
	} else {
		/**
		 * Appends path to origin respecting any existing path.
		 * Example: url: 'https://domain.com/v2', path: '/v1/logs', result: 'https://domain.com/v2/v1/logs'
		 * Example: url: 'https://domain.com', path: '/v1/logs', result: 'https://domain.com/v1/logs'
		 * Example: url: 'https://domain.com/test', path: 'v1/logs', result: 'https://domain.com/test/v1/logs'
		 */
		let baseUrlPathName = baseUrlWithPrefix.pathname

		if (baseUrlPathName.endsWith('/') && pathName.startsWith('/')) {
			// remove slash to avoid double slashes in final URL
			baseUrlPathName = baseUrlPathName.slice(0, -1)
		}

		return new URL(`${baseUrlPathName}${pathName}`, baseUrlWithPrefix.origin)
	}
}
