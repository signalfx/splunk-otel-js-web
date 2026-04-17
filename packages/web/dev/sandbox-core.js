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

/* global SplunkRum, SplunkSessionRecorder */

// ── DOM helpers ──────────────────────────────────────────────────────────
export const $ = (sel) => document.querySelector(sel)
export const $input = (sel) => /** @type {HTMLInputElement | null} */ (document.querySelector(sel))
export const inputValue = (sel) => $input(sel)?.value?.trim() ?? ''
export const checked = (sel) => $input(sel)?.checked ?? false

// ── Logger ───────────────────────────────────────────────────────────────
let logCount = 0

/**
 * @param {string} msg
 * @param {'msg' | 'info' | 'warn' | 'error'} [level]
 */
export function log(msg, level = 'msg') {
	const logEl = $('#log')
	if (!logEl) {
		return
	}

	logCount += 1
	const countBadge = $('#console-count')
	if (countBadge) {
		countBadge.textContent = String(logCount)
	}

	const ts = new Date().toLocaleTimeString('en-GB', {
		hour: '2-digit',
		hour12: false,
		minute: '2-digit',
		second: '2-digit',
	})
	const entry = document.createElement('div')
	entry.className = 'log-entry'

	const tsSpan = document.createElement('span')
	tsSpan.className = 'log-ts'
	tsSpan.textContent = ts

	const msgSpan = document.createElement('span')
	msgSpan.className = `log-msg ${level}`
	msgSpan.textContent = String(msg)

	entry.append(tsSpan, msgSpan)
	logEl.append(entry)

	while (logEl.children.length > 500) {
		logEl.firstChild?.remove()
	}
	logEl.scrollTop = logEl.scrollHeight
}

// ── Config persistence ────────────────────────────────────────────────────
const LS_KEY = 'splunk-rum-dev-config'
const LS_TOKEN_KEY = 'splunk-rum-dev-token'

const CFG_TEXT_DEFAULTS = {
	'cfg-app': 'splunk-otel-web-dev',
	'cfg-beacon': 'http://localhost:9411/api/v2/spans',
	'cfg-env': 'dev',
	'cfg-realm': '',
	'cfg-recorder-beacon': 'http://localhost:9411/v1/rumreplay',
	'cfg-recorder-sensitivity-rules':
		'[\n  { "rule": "mask",    "selector": "[data-sensitive]" },\n  { "rule": "unmask",  "selector": "[data-unmask]" },\n  { "rule": "exclude", "selector": "[data-exclude]" }\n]',
}

const CFG_CHECKBOX_DEFAULTS = {
	'cfg-recorder-enabled': false,
	'cfg-recorder-feature-canvas': false,
	'cfg-recorder-feature-iframes': false,
	'cfg-recorder-feature-pack-assets': false,
	'cfg-recorder-feature-video': false,
	'cfg-recorder-mask-all-inputs': true,
	'cfg-recorder-mask-all-text': false,
}

function loadConfig() {
	let saved = {}
	try {
		const parsed = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
		saved = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
	} catch {
		// ignore malformed storage
	}
	for (const [id, def] of Object.entries(CFG_TEXT_DEFAULTS)) {
		const el = $(`#${id}`)
		if (el) {
			el.value = id in saved ? saved[id] : def
		}
	}
	for (const [id, def] of Object.entries(CFG_CHECKBOX_DEFAULTS)) {
		const el = $input(`#${id}`)
		if (el) {
			el.checked = id in saved ? Boolean(saved[id]) : def
		}
	}
	const tokenEl = $input('#cfg-token')
	if (tokenEl) {
		tokenEl.value = localStorage.getItem(LS_TOKEN_KEY) ?? ''
	}
}

function saveConfig() {
	const textData = Object.fromEntries(
		Object.keys(CFG_TEXT_DEFAULTS).map((id) => [id, $input(`#${id}`)?.value.trim() ?? '']),
	)
	const checkboxData = Object.fromEntries(
		Object.keys(CFG_CHECKBOX_DEFAULTS).map((id) => [id, $input(`#${id}`)?.checked ?? false]),
	)
	localStorage.setItem(LS_KEY, JSON.stringify({ ...textData, ...checkboxData }))

	const token = inputValue('#cfg-token')
	if (token) {
		localStorage.setItem(LS_TOKEN_KEY, token)
	} else {
		localStorage.removeItem(LS_TOKEN_KEY)
	}
}

// ── SDK Init ──────────────────────────────────────────────────────────────
function getConfig() {
	const realm = inputValue('#cfg-realm')
	const base = {
		applicationName: inputValue('#cfg-app') || 'splunk-otel-web-dev',
		debug: true,
		deploymentEnvironment: inputValue('#cfg-env') || 'dev',
		rumAccessToken: inputValue('#cfg-token') || undefined,
	}

	if (realm) {
		return { ...base, realm }
	}

	return {
		...base,
		allowInsecureBeacon: true,
		beaconEndpoint: inputValue('#cfg-beacon') || 'http://localhost:9411/api/v2/spans',
	}
}

/** @param {'loading' | 'initialized' | 'deinitialized' | 'error' | 'not found'} status */
function setSdkStatus(status) {
	const dotClass = {
		'deinitialized': 'yellow',
		'error': 'red',
		'initialized': 'green',
		'loading': '',
		'not found': 'red',
	}
	const dot = $('#sdk-dot')
	if (dot) {
		dot.className = `dot ${dotClass[status] ?? ''}`
	}

	const label = $('#sdk-status')
	if (label) {
		label.textContent = status
	}
}

/** @type {(() => void) | null} */
let onSessionChanged = null

function initSdk() {
	if (typeof SplunkRum === 'undefined') {
		log('SplunkRum not found on window — check bundle', 'error')
		setSdkStatus('not found')
		return
	}

	const config = getConfig()
	log(
		`Initializing with ${config.beaconEndpoint ? `beaconEndpoint: ${config.beaconEndpoint}` : `realm: ${config.realm}`}`,
		'info',
	)

	try {
		SplunkRum.init(config)
		setSdkStatus('initialized')

		const sdkVersion = $('#sdk-version')
		if (sdkVersion) {
			sdkVersion.textContent = SplunkRum._processedOptions?.version ?? '—'
		}

		const sessionEl = $('#session-id')
		if (sessionEl) {
			sessionEl.textContent = SplunkRum.getSessionId() ?? '—'
		}

		const beaconEl = $('#beacon-endpoint')
		if (beaconEl) {
			beaconEl.textContent =
				config.beaconEndpoint ?? SplunkRum._processedOptions?.beaconEndpoint ?? `realm: ${config.realm}`
		}

		log('SplunkRum initialized ✓', 'info')

		if (onSessionChanged) {
			SplunkRum.removeEventListener('session-changed', onSessionChanged)
		}

		onSessionChanged = () => {
			const newId = SplunkRum.getSessionId() ?? '—'
			const el = $('#session-id')
			if (el) {
				el.textContent = newId
			}

			log(`Session changed → ${newId}`, 'info')
		}
		SplunkRum.addEventListener('session-changed', onSessionChanged)

		initRecorder()
	} catch (error) {
		log(`Init error: ${error.message}`, 'error')
		setSdkStatus('error')
	}
}

// ── Session Recorder ──────────────────────────────────────────────────────

const RECORDER_DOT_CLASS = { error: 'red', off: '', recording: 'green', unavailable: 'yellow' }

/** @param {'off' | 'recording' | 'error' | 'unavailable'} status */
function setRecorderStatus(status) {
	const dot = $('#recorder-dot')
	const label = $('#recorder-status')
	if (dot) {
		dot.className = `dot ${RECORDER_DOT_CLASS[status] ?? ''}`
	}

	if (label) {
		label.textContent = status
	}
}

/**
 * Parse and validate the sensitivityRules textarea.
 * Returns { ok, rules } — if ok is false, the textarea is highlighted.
 */
function parseSensitivityRules() {
	const el = /** @type {HTMLTextAreaElement} */ ($('#cfg-recorder-sensitivity-rules'))
	const errorEl = $('#cfg-recorder-sensitivity-error')

	if (!el) {
		return { ok: true, rules: undefined }
	}

	const raw = el.value.trim()
	if (!raw) {
		return { ok: true, rules: undefined }
	}

	try {
		const rules = JSON.parse(raw)
		if (!Array.isArray(rules)) {
			throw new TypeError('value must be a JSON array')
		}

		el.classList.remove('invalid')
		if (errorEl) {
			errorEl.classList.add('hidden')
		}

		return { ok: true, rules }
	} catch (error) {
		el.classList.add('invalid')
		if (errorEl) {
			errorEl.textContent = `JSON error: ${error.message}`
			errorEl.classList.remove('hidden')
		}

		return { ok: false, rules: undefined }
	}
}

function initRecorder() {
	const enabled = checked('#cfg-recorder-enabled')
	if (!enabled) {
		setRecorderStatus('off')
		return
	}

	if (typeof SplunkSessionRecorder === 'undefined') {
		log('SplunkSessionRecorder not found — build packages/session-recorder first', 'warn')
		setRecorderStatus('unavailable')
		return
	}

	const { ok, rules } = parseSensitivityRules()
	if (!ok) {
		log('sensitivityRules JSON is invalid — fix before re-initializing', 'error')
		setRecorderStatus('error')
		return
	}

	const beaconEndpoint = inputValue('#cfg-recorder-beacon')
	const realm = inputValue('#cfg-realm')

	const features = {
		canvas: checked('#cfg-recorder-feature-canvas'),
		iframes: checked('#cfg-recorder-feature-iframes'),
		packAssets: checked('#cfg-recorder-feature-pack-assets'),
		video: checked('#cfg-recorder-feature-video'),
	}
	const hasFeatures = Object.values(features).some(Boolean)

	try {
		SplunkSessionRecorder.init({
			...(beaconEndpoint ? { beaconEndpoint } : {}),
			...(realm ? { realm } : {}),
			...(hasFeatures ? { features } : {}),
			...(rules ? { sensitivityRules: rules } : {}),
			debug: true,
			maskAllInputs: $input('#cfg-recorder-mask-all-inputs')?.checked ?? true,
			maskAllText: checked('#cfg-recorder-mask-all-text'),
			rumAccessToken: inputValue('#cfg-token') || undefined,
		})

		if (SplunkSessionRecorder.inited) {
			log(`SplunkSessionRecorder initialized ✓ → ${beaconEndpoint || '(default)'}`, 'info')
			setRecorderStatus('recording')
		} else {
			log('SplunkSessionRecorder.init() returned without initializing — check console for details', 'warn')
			setRecorderStatus('error')
		}
	} catch (error) {
		log(`Session recorder init error: ${error.message}`, 'error')
		setRecorderStatus('error')
	}
}

function reinitSdk() {
	saveConfig()

	if (typeof SplunkSessionRecorder !== 'undefined' && SplunkSessionRecorder.inited) {
		SplunkSessionRecorder.deinit()
		log('SplunkSessionRecorder deinitialized', 'warn')
	}

	setRecorderStatus('off')

	if (typeof SplunkRum !== 'undefined' && SplunkRum.inited) {
		if (onSessionChanged) {
			SplunkRum.removeEventListener('session-changed', onSessionChanged)
			onSessionChanged = null
		}

		SplunkRum.deinit()
		log('SplunkRum deinitialized', 'warn')
		setSdkStatus('deinitialized')
	}

	initSdk()
}

// ── Modal injection ───────────────────────────────────────────────────────

function injectModal() {
	const backdrop = document.createElement('div')
	backdrop.id = 'config-backdrop'
	backdrop.className = 'modal-backdrop hidden'
	backdrop.innerHTML = `
		<div id="config-modal" class="modal">
			<div class="modal-header">
				<h2>Init Config</h2>
				<button id="btn-config-close" class="icon-btn" aria-label="Close">&times;</button>
			</div>

			<div class="config-grid">
				<div class="field">
					<label>applicationName</label>
					<input type="text" id="cfg-app" value="splunk-otel-web-dev" />
				</div>
				<div class="field">
					<label>deploymentEnvironment</label>
					<input type="text" id="cfg-env" value="dev" />
				</div>
				<div class="field">
					<label>realm <span class="field-hint">(overrides beaconEndpoint)</span></label>
					<input type="text" id="cfg-realm" placeholder="e.g. mon0, us0, eu0" />
				</div>
				<div class="field">
					<label>rumAccessToken <span class="field-hint">(dev/test tokens only)</span></label>
					<input type="password" id="cfg-token" placeholder="required when realm is set" />
				</div>
				<div class="field field-wide">
					<label>beaconEndpoint <span class="field-hint">(used when realm is empty)</span></label>
					<input type="text" id="cfg-beacon" value="http://localhost:9411/api/v2/spans" />
				</div>
			</div>

			<button id="btn-reinit" class="reinit-btn">Re-initialize SDK</button>

			<h3 class="modal-subheading">Session Recorder</h3>
			<div class="config-grid">
				<div class="field field-wide">
					<label class="toggle-label">
						<input type="checkbox" id="cfg-recorder-enabled" />
						<span>Enable session recorder</span>
					</label>
				</div>
				<div class="field field-wide">
					<label>recorder beaconEndpoint <span class="field-hint">(replay ingest URL)</span></label>
					<input type="text" id="cfg-recorder-beacon" placeholder="e.g. https://rum-ingest.us0.signalfx.com/v1/rumreplay" />
				</div>
				<div class="field">
					<label class="toggle-label">
						<input type="checkbox" id="cfg-recorder-mask-all-inputs" />
						<span>maskAllInputs</span>
					</label>
				</div>
				<div class="field">
					<label class="toggle-label">
						<input type="checkbox" id="cfg-recorder-mask-all-text" />
						<span>maskAllText</span>
					</label>
				</div>
				<div class="field field-wide">
					<label>features</label>
					<div class="feature-toggles">
						<label class="toggle-label">
							<input type="checkbox" id="cfg-recorder-feature-canvas" />
							<span>canvas</span>
						</label>
						<label class="toggle-label">
							<input type="checkbox" id="cfg-recorder-feature-video" />
							<span>video</span>
						</label>
						<label class="toggle-label">
							<input type="checkbox" id="cfg-recorder-feature-iframes" />
							<span>iframes</span>
						</label>
						<label class="toggle-label">
							<input type="checkbox" id="cfg-recorder-feature-pack-assets" />
							<span>packAssets</span>
						</label>
					</div>
				</div>
				<div class="field field-wide">
					<label>sensitivityRules <span class="field-hint">(JSON array — applied on Re-initialize)</span></label>
					<textarea id="cfg-recorder-sensitivity-rules" rows="6" spellcheck="false"></textarea>
					<span id="cfg-recorder-sensitivity-error" class="field-error hidden"></span>
				</div>
			</div>
		</div>
	`
	document.body.append(backdrop)
}

function openConfig() {
	$('#config-backdrop')?.classList.remove('hidden')
}

function closeConfig() {
	$('#config-backdrop')?.classList.add('hidden')
}

function wireModalHandlers() {
	const backdrop = $('#config-backdrop')
	$('#btn-config')?.addEventListener('click', openConfig)
	$('#btn-config-close')?.addEventListener('click', closeConfig)
	$('#btn-reinit')?.addEventListener('click', reinitSdk)
	backdrop?.addEventListener('click', (e) => {
		if (e.target === backdrop) {
			closeConfig()
		}
	})
}

// ── Public API ────────────────────────────────────────────────────────────

export function doRecorderResume() {
	if (typeof SplunkSessionRecorder === 'undefined' || !SplunkSessionRecorder.inited) {
		log('Session recorder not initialized', 'error')
		return
	}

	SplunkSessionRecorder.resume()
	log('SplunkSessionRecorder.resume() called', 'info')
	setRecorderStatus('recording')
}

export function doRecorderStop() {
	if (typeof SplunkSessionRecorder === 'undefined' || !SplunkSessionRecorder.inited) {
		log('Session recorder not initialized', 'error')
		return
	}

	SplunkSessionRecorder.stop()
	log('SplunkSessionRecorder.stop() called', 'warn')
	setRecorderStatus('off')
}

export function init() {
	injectModal()
	loadConfig()
	initSdk()
	wireModalHandlers()

	window.addEventListener('focus', () => {
		if (typeof SplunkRum !== 'undefined' && SplunkRum.inited) {
			const el = $('#session-id')
			if (el) {
				el.textContent = SplunkRum.getSessionId() ?? '—'
			}
		}
	})
}
