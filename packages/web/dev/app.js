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
 * RUM sandbox page — interaction handlers only.
 * Shared config, SDK init, recorder init, and the settings modal are
 * provided by sandbox-core.js.
 */

/* global SplunkRum */

import { $, doRecorderResume, doRecorderStop, init, log } from './sandbox-core.js'

// ── Interaction handlers ──────────────────────────────────────────────────

async function doFetch() {
	log('fetch /api/data …')
	try {
		await fetch('/api/data')
		log('fetch /api/data → ok')
	} catch {
		log('fetch /api/data → network error (expected in dev)', 'warn')
	}
}

function doXhr() {
	log('XHR GET /api/items …')
	const xhr = new XMLHttpRequest()
	xhr.open('GET', '/api/items')
	xhr.addEventListener('load', () => log(`XHR /api/items → ${xhr.status}`))
	xhr.addEventListener('error', () => log('XHR /api/items → network error (expected in dev)', 'warn'))
	xhr.send()
}

function doNavigation() {
	// dev-only: crypto.randomUUID() requires a current browser (Chrome 92+, FF 95+, Safari 15.4+)
	const path = `/page-${crypto.randomUUID().slice(0, 4)}`
	history.pushState({}, '', path)
	log(`pushState → ${path}`)
}

function doError() {
	log('Throwing unhandled error …', 'warn')
	setTimeout(() => {
		throw new Error('Dev sandbox test error')
	}, 0)
}

function doReportError() {
	if (typeof SplunkRum === 'undefined' || !SplunkRum.inited) {
		log('SDK not initialized', 'error')
		return
	}

	const err = new Error('Manually reported error from dev sandbox')
	SplunkRum.reportError(err)
	log('reportError() called ✓')
}

function doCustomSpan() {
	if (typeof SplunkRum === 'undefined' || !SplunkRum.inited) {
		log('SDK not initialized', 'error')
		return
	}

	const tracer = SplunkRum.provider.getTracer('dev-sandbox')
	const span = tracer.startSpan('custom.dev-span', { attributes: { 'custom.key': 'hello' } })
	span.end()
	log('Custom span emitted ✓')
}

function doLongTask() {
	log('Starting long task (300ms block) …', 'warn')
	const start = Date.now()
	while (Date.now() - start < 300) {
		/* busy wait */
	}
	log('Long task complete')
}

function doSetAttribute() {
	if (typeof SplunkRum === 'undefined' || !SplunkRum.inited) {
		log('SDK not initialized', 'error')
		return
	}

	const key = 'dev.timestamp'
	const val = new Date().toISOString()
	SplunkRum.setGlobalAttributes({ [key]: val })
	log(`setGlobalAttributes({ "${key}": "${val}" }) ✓`)
}

// ── Boot ──────────────────────────────────────────────────────────────────

/** @type {Record<string, () => void>} */
const actions = {
	'btn-custom-span': doCustomSpan,
	'btn-error': doError,
	'btn-fetch': doFetch,
	'btn-long-task': doLongTask,
	'btn-navigation': doNavigation,
	'btn-recorder-resume': doRecorderResume,
	'btn-recorder-stop': doRecorderStop,
	'btn-report-error': doReportError,
	'btn-set-attribute': doSetAttribute,
	'btn-xhr': doXhr,
}

window.addEventListener('DOMContentLoaded', () => {
	init()

	for (const [id, handler] of Object.entries(actions)) {
		$(`#${id}`)?.addEventListener('click', handler)
	}
})
