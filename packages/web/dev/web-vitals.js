/**
 *
 * Copyright 2020-2026 Splunk Inc.
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

/**
 * Web Vitals sandbox page handlers.
 * Shared config, SDK init, recorder init, and the settings modal are provided
 * by sandbox-core.js.
 */

import { $, init, log } from './sandbox-core.js'

window.addEventListener('DOMContentLoaded', () => {
	init()
	log('Web Vitals page initialized. Hard reload to capture LCP attribution.', 'info')

	$('#btn-reload')?.addEventListener('click', () => {
		const url = new URL(location.href)
		url.searchParams.set('reload', String(Date.now()))
		location.assign(url.toString())
	})
})
