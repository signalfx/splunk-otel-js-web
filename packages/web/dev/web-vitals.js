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

const metricLabels = {
	cls: 'CLS',
	fcp: 'FCP',
	hub: 'Web Vitals',
	inp: 'INP',
	lcp: 'LCP',
	ttfb: 'TTFB',
}

function reloadPage() {
	const url = new URL(location.href)
	url.searchParams.set('reload', String(Date.now()))
	location.assign(url.toString())
}

function blockMainThread(duration) {
	const startedAt = performance.now()
	while (performance.now() - startedAt < duration) {
		// Busy loop intentionally creates measurable interaction latency in this dev fixture.
	}
}

function initReloadButton() {
	$('#btn-reload')?.addEventListener('click', reloadPage)
}

function initCLSPage() {
	const anchor = $('#shift-anchor')
	const shiftButton = $('#btn-shift')

	const shiftPage = () => {
		if (!anchor || $('#shift-banner')) {
			return
		}

		const banner = document.createElement('div')
		banner.id = 'shift-banner'
		banner.className = 'shift-banner'
		banner.textContent = 'Delayed content inserted above the stable target.'
		anchor.append(banner)
		log('CLS fixture inserted delayed content above the target.', 'info')
	}

	setTimeout(shiftPage, 1200)
	shiftButton?.addEventListener('click', reloadPage)
}

function initINPPage() {
	const button = $('#btn-inp')
	const result = $('#inp-result')
	let count = 0

	button?.addEventListener('click', () => {
		blockMainThread(180)
		count += 1
		if (result) {
			result.textContent = `processed interaction ${count} after intentional main-thread work`
		}

		log('INP fixture processed a delayed interaction.', 'info')
	})
}

function initFCPPage() {
	log('FCP fixture rendered visible content during initial page load.', 'info')
}

function initTTFBPage() {
	const timingValue = $('#timing-value')
	const navigation = performance.getEntriesByType('navigation')[0]
	const responseStart = navigation && 'responseStart' in navigation ? navigation.responseStart : undefined

	if (timingValue && typeof responseStart === 'number') {
		timingValue.textContent = `${Math.round(responseStart)} ms`
	}
}

window.addEventListener('DOMContentLoaded', () => {
	init()
	initReloadButton()

	const metric = document.body.dataset.webVitalsMetric || 'hub'
	log(`${metricLabels[metric] || 'Web Vitals'} sandbox page initialized.`, 'info')

	switch (metric) {
		case 'cls': {
			initCLSPage()
			break
		}
		case 'fcp': {
			initFCPPage()
			break
		}
		case 'inp': {
			initINPPage()
			break
		}
		case 'ttfb': {
			initTTFBPage()
			break
		}
		default:
	}
})
