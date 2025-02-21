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
import { isRequiredAPISupported } from './required-api-check'
import { SESSION_REPLAY_BROWSER_SCRIPT_URL, SESSION_REPLAY_BROWSER_LEGACY_SCRIPT_URL } from './constants'

export const loadRecorderBrowserScript = async () => {
	const recorderScriptUrl: string = isRequiredAPISupported()
		? SESSION_REPLAY_BROWSER_SCRIPT_URL
		: SESSION_REPLAY_BROWSER_LEGACY_SCRIPT_URL

	// const currentScript = document.currentScript as HTMLScriptElement | null
	// if (currentScript) {
	// 	const scriptUrl = new URL(currentScript.src ?? window.location.href)
	// 	recorderScriptUrl = scriptUrl.searchParams.get('recorderScriptUrl') ?? recorderScriptUrl
	// }

	await new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = recorderScriptUrl
		script.addEventListener('load', resolve)
		script.addEventListener('error', reject)

		document.head.append(script)
	})

	console.log('Recorder script loaded from URL:', recorderScriptUrl)
}
