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
const LS_PRESET_KEY = 'splunk-rum-dev-preset'
const OTEL_API_SYMBOL = Symbol.for('opentelemetry.js.api.1')
const SPLUNK_RUM_VERSION_KEY = 'splunk.rum.version'

const CFG_TEXT_DEFAULTS = {
	'cfg-app': 'splunk-otel-web-dev',
	'cfg-beacon': '',
	'cfg-env': 'dev',
	'cfg-realm': '',
	'cfg-recorder-beacon': '',
	'cfg-recorder-pack-assets-images-quality': '',
	'cfg-recorder-sensitivity-rules':
		'[\n  { "rule": "mask",    "selector": "[data-sensitive]" },\n  { "rule": "unmask",  "selector": "[data-unmask]" },\n  { "rule": "exclude", "selector": "[data-exclude]" }\n]',
}

const CFG_CHECKBOX_DEFAULTS = {
	'cfg-recorder-enabled': false,
	'cfg-recorder-feature-canvas': false,
	'cfg-recorder-feature-iframes': false,
	'cfg-recorder-feature-video': false,
	'cfg-recorder-mask-all-inputs': true,
	'cfg-recorder-mask-all-text': false,
	'cfg-recorder-pack-assets': false,
	'cfg-recorder-pack-assets-fonts': false,
	'cfg-recorder-pack-assets-hash-asset-content': false,
	'cfg-recorder-pack-assets-images': false,
	'cfg-recorder-pack-assets-images-only-viewport': false,
	'cfg-recorder-pack-assets-images-pack': false,
	'cfg-recorder-pack-assets-styles': true,
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

	const presetEl = $input('#cfg-preset')
	if (presetEl) {
		const val = presetEl.value
		if (val) {
			localStorage.setItem(LS_PRESET_KEY, val)
		} else {
			localStorage.removeItem(LS_PRESET_KEY)
		}
	}
}

function syncRecorderConfigVisibility() {
	const recorderFields = $('#recorder-config-fields')
	const enabledInput = $input('#cfg-recorder-enabled')
	if (!recorderFields || !enabledInput) {
		return
	}

	recorderFields.classList.toggle('hidden', !enabledInput.checked)
}

// ── Realm presets ─────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id: string,
 *   realm: string,
 *   token: string,
 *   applicationName?: string,
 *   deploymentEnvironment?: string,
 *   beaconEndpoint?: string,
 *   recorderBeaconEndpoint?: string
 * }} Preset
 */

/**
 * Presets injected by webpack at dev-server startup from packages/web/.env.
 * Falls back to an empty array when running outside the dev server.
 *
 * @type {Preset[]}
 */
const _presets = /** @type {Preset[]} */ (
	Array.isArray(/** @type {any} */ (globalThis).__DEV_PRESETS__)
		? /** @type {any} */ (globalThis).__DEV_PRESETS__
		: []
)

/**
 * Map input ids to the preset property that populates them.
 *
 * @type {Record<string, keyof Preset>}
 */
const PRESET_FIELD_MAP = {
	'cfg-app': 'applicationName',
	'cfg-beacon': 'beaconEndpoint',
	'cfg-env': 'deploymentEnvironment',
	'cfg-realm': 'realm',
	'cfg-recorder-beacon': 'recorderBeaconEndpoint',
	'cfg-token': 'token',
}

/**
 * Lock (readonly) fields populated by the given preset, or clear the lock when preset is null.
 *
 * @param {Preset | null} preset
 */
function applyPresetLock(preset) {
	for (const [id, prop] of Object.entries(PRESET_FIELD_MAP)) {
		const el = $input(`#${id}`)
		if (!el) {
			continue
		}

		const locked = preset ? preset[prop] !== undefined : false
		el.readOnly = locked
		el.classList.toggle('preset-locked', locked)
	}
}

/**
 * Populate form fields from the preset with the given id.
 *
 * @param {string} id
 */
function applyPreset(id) {
	const preset = _presets.find((p) => p.id === id)
	if (!preset) {
		applyPresetLock(null)
		return
	}

	const realmEl = $input('#cfg-realm')
	if (realmEl) {
		realmEl.value = preset.realm
	}

	const tokenEl = $input('#cfg-token')
	if (tokenEl) {
		tokenEl.value = preset.token
	}

	if (preset.applicationName) {
		const appEl = $input('#cfg-app')
		if (appEl) {
			appEl.value = preset.applicationName
		}
	}

	if (preset.deploymentEnvironment) {
		const envEl = $input('#cfg-env')
		if (envEl) {
			envEl.value = preset.deploymentEnvironment
		}
	}

	if (preset.beaconEndpoint !== undefined) {
		const beaconEl = $input('#cfg-beacon')
		if (beaconEl) {
			beaconEl.value = preset.beaconEndpoint
		}
	}

	if (preset.recorderBeaconEndpoint !== undefined) {
		const recBeaconEl = $input('#cfg-recorder-beacon')
		if (recBeaconEl) {
			recBeaconEl.value = preset.recorderBeaconEndpoint
		}
	}

	applyPresetLock(preset)
}

/**
 * Populate the preset dropdown with available presets and restore last selection.
 */
function populatePresetSelect() {
	const sel = $input('#cfg-preset')
	if (!sel) {
		return
	}

	// Remove any previous option nodes beyond the placeholder
	while (sel.options.length > 1) {
		sel.remove(1)
	}

	for (const preset of _presets) {
		const opt = document.createElement('option')
		opt.value = preset.id
		opt.textContent = preset.id === preset.realm ? preset.id : `${preset.id} (${preset.realm})`
		sel.append(opt)
	}

	const saved = localStorage.getItem(LS_PRESET_KEY)
	const savedPreset = saved ? _presets.find((p) => p.id === saved) : undefined
	if (savedPreset) {
		sel.value = saved
		applyPresetLock(savedPreset)
	}
}

// ── SDK Init ──────────────────────────────────────────────────────────────
export function getRegisteredSdkVersion() {
	const otelApi = globalThis[OTEL_API_SYMBOL]
	const sdkVersion = otelApi && typeof otelApi === 'object' ? otelApi[SPLUNK_RUM_VERSION_KEY] : undefined

	return typeof sdkVersion === 'string' && sdkVersion ? sdkVersion : undefined
}

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
		beaconEndpoint: inputValue('#cfg-beacon'),
	}
}

/**
 * Realm → app host overrides. Most realms live on `app.{realm}.signalfx.com`,
 * but a few (e.g. the `rc0` release candidate) use a different subdomain.
 *
 * @type {Record<string, string>}
 */
const REALM_HOST_OVERRIDES = {
	lab0: 'sfmonitoring.lab0.signalfx.com',
	mon0: 'mon.signalfx.com',
	rc0: 'o11y-sfmonitoring.rc0.signalfx.com',
}

/**
 * @param {string} realm
 * @returns {string}
 */
function realmToHost(realm) {
	return REALM_HOST_OVERRIDES[realm] ?? `app.${realm}.signalfx.com`
}

/**
 * Build a URL pointing to the Splunk Observability Cloud RUM session detail page.
 *
 * Returns `null` when we cannot build a meaningful link (missing realm or session).
 *
 * The session-details route is a hash-based SPA route; the app will pick a
 * sensible default time window when no query params are supplied.
 *
 * @param {string | undefined} realm
 * @param {string | undefined} sessionId
 * @returns {string | null}
 */
function buildSessionDetailUrl(realm, sessionId) {
	if (!realm || !sessionId) {
		return null
	}

	const host = realmToHost(realm)
	const safeSessionId = encodeURIComponent(sessionId)
	return `https://${host}/#/rum/sessions/${safeSessionId}`
}

/**
 * Update the session-id element to reflect the current session and whether we
 * can link out to Observability Cloud.
 *
 * @param {string | undefined} sessionId
 */
function updateSessionIdLink(sessionId) {
	const el = /** @type {HTMLAnchorElement | null} */ ($('#session-id'))
	if (!el) {
		return
	}

	const display = sessionId ?? '—'
	el.textContent = display

	const realm = inputValue('#cfg-realm')
	const href = buildSessionDetailUrl(realm, sessionId)
	if (href) {
		el.href = href
		el.dataset.enabled = 'true'
		el.title = `Open session in ${realmToHost(realm)}`
	} else {
		el.href = '#'
		delete el.dataset.enabled
		el.removeAttribute('title')
	}

	const copyBtn = /** @type {HTMLButtonElement | null} */ ($('#btn-copy-session-id'))
	if (copyBtn) {
		copyBtn.disabled = !sessionId
		if (!sessionId) {
			delete copyBtn.dataset.copied
		}
	}
}

/** @type {ReturnType<typeof setTimeout> | null} */
let copyFeedbackTimer = null

async function copySessionIdToClipboard() {
	const btn = /** @type {HTMLButtonElement | null} */ ($('#btn-copy-session-id'))
	const sessionId = typeof SplunkRum === 'undefined' ? null : SplunkRum.getSessionId()
	if (!btn || !sessionId) {
		return
	}

	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(sessionId)
		} else {
			const ta = document.createElement('textarea')
			ta.value = sessionId
			ta.setAttribute('readonly', '')
			ta.style.position = 'absolute'
			ta.style.left = '-9999px'
			document.body.append(ta)
			ta.select()
			document.execCommand('copy')
			document.body.removeChild(ta)
		}

		btn.dataset.copied = 'true'
		const originalTitle = 'Copy session ID'
		btn.title = 'Copied!'
		btn.setAttribute('aria-label', 'Copied')
		log(`Session ID copied to clipboard`, 'info')

		if (copyFeedbackTimer) {
			clearTimeout(copyFeedbackTimer)
		}

		copyFeedbackTimer = setTimeout(() => {
			delete btn.dataset.copied
			btn.title = originalTitle
			btn.setAttribute('aria-label', originalTitle)
			copyFeedbackTimer = null
		}, 1500)
	} catch (error) {
		log(`Failed to copy session ID: ${error.message}`, 'error')
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
		return false
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
			sdkVersion.textContent = getRegisteredSdkVersion() ?? '—'
		}

		updateSessionIdLink(SplunkRum.getSessionId() ?? undefined)

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
			const newId = SplunkRum.getSessionId() ?? undefined
			updateSessionIdLink(newId)
			log(`Session changed → ${newId ?? '—'}`, 'info')
		}
		SplunkRum.addEventListener('session-changed', onSessionChanged)

		return initRecorder()
	} catch (error) {
		log(`Init error: ${error.message}`, 'error')
		setSdkStatus('error')
		return false
	}
}

// ── Session Recorder ──────────────────────────────────────────────────────

/**
 * UI-only status for the recorder badge.
 *
 *  - `off`          recorder is disabled in config, or was deinitialized.
 *  - `recording`    recorder is inited and we have not locally paused it.
 *  - `paused`       recorder is still inited but `.stop()` was called from the dev UI.
 *                   Kept distinct from `off` so the user can tell "I paused it" from
 *                   "it isn't running at all".
 *  - `unavailable`  bundle didn't load (build packages/session-recorder first).
 *  - `error`        runtime failure during `SplunkSessionRecorder.init()`. Not used
 *                   for invalid dev-modal JSON – that surfaces inline in the modal.
 *
 * @typedef {'off' | 'recording' | 'paused' | 'error' | 'unavailable'} RecorderUiStatus
 */

/** @type {Record<RecorderUiStatus, string>} */
const RECORDER_DOT_CLASS = {
	error: 'red',
	off: '',
	paused: 'yellow',
	recording: 'green',
	unavailable: 'yellow',
}

/** @type {RecorderUiStatus} */
let recorderUiStatus = 'off'

/** @param {RecorderUiStatus} status */
function setRecorderStatus(status) {
	recorderUiStatus = status
	const dot = $('#recorder-dot')
	const label = $('#recorder-status')
	if (dot) {
		dot.className = `dot ${RECORDER_DOT_CLASS[status] ?? ''}`
	}

	if (label) {
		label.textContent = status
	}

	syncRecorderButtons(status)
}

/**
 * Enable Stop only while recording, Resume only while paused. Keeps the dev UI
 * honest about which transitions are actually actionable and stops users from
 * spamming no-op calls that just log "Session recorder not initialized".
 *
 * @param {RecorderUiStatus} status
 */
function syncRecorderButtons(status) {
	const stopBtn = /** @type {HTMLButtonElement | null} */ ($('#btn-recorder-stop'))
	const resumeBtn = /** @type {HTMLButtonElement | null} */ ($('#btn-recorder-resume'))
	if (stopBtn) {
		stopBtn.disabled = status !== 'recording'
	}

	if (resumeBtn) {
		resumeBtn.disabled = status !== 'paused'
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
		return true
	}

	if (typeof SplunkSessionRecorder === 'undefined') {
		log('SplunkSessionRecorder not found — build packages/session-recorder first', 'warn')
		setRecorderStatus('unavailable')
		return true
	}

	const { ok, rules } = parseSensitivityRules()
	if (!ok) {
		log('sensitivityRules JSON is invalid — fix before re-initializing', 'error')
		return false
	}

	const beaconEndpoint = inputValue('#cfg-recorder-beacon')
	const realm = inputValue('#cfg-realm')

	const packAssetsEnabled = checked('#cfg-recorder-pack-assets')
	let packAssets
	if (packAssetsEnabled) {
		const fonts = checked('#cfg-recorder-pack-assets-fonts')
		const styles = checked('#cfg-recorder-pack-assets-styles')
		const hashAssetContent = checked('#cfg-recorder-pack-assets-hash-asset-content')
		const imagesEnabled = checked('#cfg-recorder-pack-assets-images')
		const onlyViewportImages = checked('#cfg-recorder-pack-assets-images-only-viewport')
		const imagePack = checked('#cfg-recorder-pack-assets-images-pack')
		const qualityRaw = inputValue('#cfg-recorder-pack-assets-images-quality')
		const qualityNum = Number(qualityRaw)
		const quality =
			qualityRaw !== '' && Number.isFinite(qualityNum) ? Math.min(100, Math.max(1, qualityNum)) : undefined

		let images
		if (imagesEnabled) {
			images =
				onlyViewportImages || imagePack || quality !== undefined
					? {
							...(onlyViewportImages ? { onlyViewportImages: true } : {}),
							...(imagePack ? { pack: true } : {}),
							...(quality === undefined ? {} : { quality }),
						}
					: true
		}

		const hasSubFlags = fonts || styles || hashAssetContent || images !== undefined
		packAssets = hasSubFlags
			? {
					...(fonts ? { fonts: true } : {}),
					...(styles ? { styles: true } : {}),
					...(hashAssetContent ? { hashAssetContent: true } : {}),
					...(images === undefined ? {} : { images }),
				}
			: true
	}

	const features = {
		canvas: checked('#cfg-recorder-feature-canvas'),
		iframes: checked('#cfg-recorder-feature-iframes'),
		...(packAssets === undefined ? {} : { packAssets }),
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
			return true
		} else {
			log('SplunkSessionRecorder.init() returned without initializing — check console for details', 'warn')
			setRecorderStatus('error')
			return false
		}
	} catch (error) {
		log(`Session recorder init error: ${error.message}`, 'error')
		setRecorderStatus('error')
		return false
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

	return initSdk()
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

			<div class="modal-body">
				<div class="config-grid">
					<div class="field field-wide">
						<label>Preset <span class="field-hint">(from .env — overwrites fields below)</span></label>
						<select id="cfg-preset">
							<option value="">— none —</option>
						</select>
					</div>
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
						<label>beaconEndpoint <span class="field-hint">(leave empty to use default realm endpoint)</span></label>
						<input type="text" id="cfg-beacon" placeholder="e.g. http://localhost:9411/api/v2/spans" />
					</div>
				</div>
				<h3 class="modal-subheading">Session Recorder</h3>
				<div class="config-grid">
					<div class="field field-wide">
						<label class="toggle-label">
							<input type="checkbox" id="cfg-recorder-enabled" />
							<span>Enable session recorder</span>
						</label>
					</div>
					<div id="recorder-config-fields" class="field field-wide">
						<div class="config-grid">
							<div class="field field-wide">
								<label>recorder beaconEndpoint <span class="field-hint">(leave empty to use default realm endpoint)</span></label>
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
								</div>
							</div>
							<div class="field field-wide">
								<label>packAssets</label>
								<div class="feature-toggles">
									<label class="toggle-label">
										<input type="checkbox" id="cfg-recorder-pack-assets" />
										<span>enabled</span>
									</label>
								</div>
								<div style="margin-top:6px;padding-left:16px;border-left:2px solid #30363d;display:flex;flex-direction:column;gap:6px;">
									<label class="toggle-label">
										<input type="checkbox" id="cfg-recorder-pack-assets-fonts" />
										<span>fonts</span>
									</label>
									<label class="toggle-label">
										<input type="checkbox" id="cfg-recorder-pack-assets-styles" />
										<span>styles</span>
									</label>
									<label class="toggle-label">
										<input type="checkbox" id="cfg-recorder-pack-assets-hash-asset-content" />
										<span>hashAssetContent</span>
									</label>
									<label class="toggle-label">
										<input type="checkbox" id="cfg-recorder-pack-assets-images" />
										<span>images</span>
									</label>
									<div style="padding-left:16px;border-left:2px solid #21262d;display:flex;flex-direction:column;gap:6px;">
										<label class="toggle-label">
											<input type="checkbox" id="cfg-recorder-pack-assets-images-only-viewport" />
											<span>images.onlyViewportImages</span>
										</label>
										<label class="toggle-label">
											<input type="checkbox" id="cfg-recorder-pack-assets-images-pack" />
											<span>images.pack</span>
										</label>
										<div class="field" style="margin:0;">
											<label style="font-size:11px;color:#8b949e;">images.quality <span class="field-hint">(1–100, blank = omit)</span></label>
											<input type="number" id="cfg-recorder-pack-assets-images-quality" min="1" max="100" placeholder="e.g. 80" style="width:100px;" />
										</div>
									</div>
								</div>
							</div>
							<div class="field field-wide">
								<label>sensitivityRules <span class="field-hint">(JSON array — applied on Apply)</span></label>
								<textarea id="cfg-recorder-sensitivity-rules" rows="6" spellcheck="false"></textarea>
								<span id="cfg-recorder-sensitivity-error" class="field-error hidden"></span>
							</div>
						</div>
					</div>
				</div>

			</div>
			<div class="modal-footer">
				<button id="btn-reinit" class="reinit-btn">Apply</button>
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
	$('#cfg-recorder-enabled')?.addEventListener('change', syncRecorderConfigVisibility)
	$('#cfg-preset')?.addEventListener('change', (e) => {
		const id = /** @type {HTMLSelectElement} */ (e.target).value
		if (id) {
			applyPreset(id)
		} else {
			applyPresetLock(null)
		}
	})
	$('#btn-reinit')?.addEventListener('click', () => {
		if (reinitSdk()) {
			closeConfig()
		}
	})
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
	setRecorderStatus('paused')
}

export function init() {
	injectModal()
	loadConfig()
	syncRecorderConfigVisibility()
	wireModalHandlers()
	populatePresetSelect()
	syncRecorderButtons(recorderUiStatus)
	initSdk()

	const copyBtn = $('#btn-copy-session-id')
	if (copyBtn) {
		copyBtn.addEventListener('click', () => {
			void copySessionIdToClipboard()
		})
	}

	window.addEventListener('focus', () => {
		if (typeof SplunkRum !== 'undefined' && SplunkRum.inited) {
			updateSessionIdLink(SplunkRum.getSessionId() ?? undefined)
		}
	})
}
