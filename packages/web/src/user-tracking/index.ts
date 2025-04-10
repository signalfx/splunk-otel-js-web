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
import { safelyGetLocalStorage } from '../storage/local-store'
import { generateId } from '../utils'

const KEY = 'splunk.anonymousId'
let anonymousId: string | undefined

export const getOrCreateAnonymousId = ({ useLocalStorage }: { useLocalStorage: boolean }) => {
	if (anonymousId) {
		return anonymousId
	}

	const id = useLocalStorage ? getAnonymousIdFromLocalStorage() : getAnonymousIdFromCookie()
	anonymousId = id
	return id
}

export const forgetAnonymousId = () => {
	anonymousId = undefined
}

const getAnonymousIdFromLocalStorage = () => {
	const lsValue = safelyGetLocalStorage(KEY)
	if (lsValue) {
		return lsValue
	}

	const newId = generateAnonymousId()
	localStorage.setItem(KEY, newId)
	return newId
}

const getAnonymousIdFromCookie = () => {
	const cookieValue = document.cookie
		.split('; ')
		.find((row) => row.startsWith(KEY + '='))
		?.split('=')[1]

	if (cookieValue) {
		setCookie(cookieValue)
		return cookieValue
	}

	const newId = generateAnonymousId()
	setCookie(newId)
	return newId
}

const generateAnonymousId = () => generateId(128)

const setCookie = (newId: string) => {
	document.cookie = `${KEY}=${newId}; max-age=${60 * 60 * 24 * 400}`
}
