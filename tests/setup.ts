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
import { afterEach } from 'vitest'

afterEach(() => {
	assertSessionIsEmpty()
})

function assertSessionIsEmpty() {
	try {
		if (localStorage['_splunk_rum_sid']) {
			throw new Error('Session is expected to be empty, but is set in localStorage.')
		}

		if (document.cookie.indexOf('_splunk_rum_sid') >= 0) {
			throw new Error(`Session is expected to be empty, but is set in cookies: ${document.cookie}`)
		}
	} finally {
		delete localStorage['_splunk_rum_sid']
		document.cookie = '_splunk_rum_sid=;expires=Thu, 01 Jan 1970 00:00:00 GMT'
	}
}
