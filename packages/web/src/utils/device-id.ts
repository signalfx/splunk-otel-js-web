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
import { generateId } from '../utils'

const KEY1 = '_splunk_device_id'
const KEY2 = '_splunk_device_id_2'

const getCookie = (key: string) => {
	const cookies = document.cookie.split(';')

	try {
		for (let cookieIndex = 0; cookieIndex < cookies.length; cookieIndex += 1) {
			const cookie = cookies[cookieIndex].trim().split('=')

			if (cookie[0] === key) {
				return cookie[1]
			}
		}
	} catch {
		/// cookie is probably malformed. Ignore it.
	}

	return null
}

const getCookieExpirationDate = () => {
	const date = new Date()
	date.setMonth(date.getMonth() + 13)
	return date.toUTCString()
}

export const getDeviceId = (domain: string, keyId: 1 | 2) => {
	const idFromCookie = getCookie(keyId === 1 ? KEY1 : KEY2)
	if (idFromCookie) {
		return idFromCookie
	}

	const id = generateId(64)
	window.document.cookie = `${keyId === 1 ? KEY1 : KEY2}=${id};expires=${getCookieExpirationDate()};domain=${domain};path=/;sameSite=strict;secure`
	return id
}
