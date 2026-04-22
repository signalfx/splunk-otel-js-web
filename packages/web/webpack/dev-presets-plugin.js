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
const fs = require('node:fs')
const path = require('node:path')

const dotenv = require('dotenv')
const webpack = require('webpack')

// Reads packages/web/.env on every compilation and makes realm presets
// available to the static dev sandbox pages via a generated dev-presets.js
// (consumed by `packages/web/dev/sandbox-core.js` as `window.__DEV_PRESETS__`).

// Presets are discovered by the presence of a realm key. Each preset block is
// identified by a unique <ID> (so multiple presets may target the same realm)
// and the realm is defined inside the block via SPLUNK_RUM_REALM_<ID>.
// <ID> may contain letters, digits, underscores and hyphens so a second
// preset for the same realm can simply use a "-2" suffix, e.g. MON0-2.
const REALM_KEY_PATTERN = /^SPLUNK_RUM_REALM_([A-Za-z0-9_-]+)$/

const loadEnvFile = (filePath) => {
	try {
		return dotenv.parse(fs.readFileSync(filePath))
	} catch (error) {
		if (error && error.code !== 'ENOENT') {
			console.warn(`[DevPresetsPlugin] Failed to read ${filePath}: ${error.message}`)
		}

		return {}
	}
}

const buildDevPresets = (envPath) => {
	const env = loadEnvFile(envPath)
	const ids = Object.keys(env)
		.map((key) => REALM_KEY_PATTERN.exec(key)?.[1])
		.filter(Boolean)

	return ids
		.map((id) => {
			const realm = env[`SPLUNK_RUM_REALM_${id}`]?.trim()
			if (!realm) {
				return null
			}

			const preset = {
				id: id.toLowerCase(),
				realm: realm.toLowerCase(),
				token: env[`SPLUNK_RUM_TOKEN_${id}`] ?? '',
			}
			const app = env[`SPLUNK_RUM_APP_${id}`]
			const environment = env[`SPLUNK_RUM_ENV_${id}`]
			const beacon = env[`SPLUNK_RUM_BEACON_${id}`]
			const recorderBeacon = env[`SPLUNK_RUM_RECORDER_BEACON_${id}`]
			if (app) {
				preset.applicationName = app
			}

			if (environment) {
				preset.deploymentEnvironment = environment
			}

			if (beacon) {
				preset.beaconEndpoint = beacon
			}

			if (recorderBeacon) {
				preset.recorderBeaconEndpoint = recorderBeacon
			}

			return preset
		})
		.filter((preset) => preset !== null)
}

// JSON.stringify does not escape U+2028 / U+2029, which are valid in JSON
// strings but terminate statements in JavaScript. Escape them so the emitted
// script stays valid for any env value.
const safeStringify = (value) =>
	JSON.stringify(value)
		.replaceAll('\u2028', String.raw`\u2028`)
		.replaceAll('\u2029', String.raw`\u2029`)

/**
 * Emits `dev-presets.js` into the webpack output so the dev server serves it
 * alongside `splunk-otel-web.js`. The sandbox HTML pages load it as a plain
 * script which sets `window.__DEV_PRESETS__`.
 *
 * Registers `.env` as a file dependency so edits trigger a rebuild in watch
 * mode; when the file is absent it is tracked as a missing dependency so
 * creating it later picks it up without a restart.
 */
class DevPresetsPlugin {
	constructor({ envPath } = {}) {
		if (!envPath) {
			throw new TypeError('DevPresetsPlugin: envPath is required')
		}

		this.envPath = path.resolve(envPath)
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap('DevPresetsPlugin', (compilation) => {
			if (fs.existsSync(this.envPath)) {
				compilation.fileDependencies.add(this.envPath)
			} else {
				compilation.missingDependencies.add(this.envPath)
			}

			compilation.hooks.processAssets.tap(
				{ name: 'DevPresetsPlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
				() => {
					const presets = buildDevPresets(this.envPath)
					const src = `window.__DEV_PRESETS__ = ${safeStringify(presets)};\n`
					compilation.emitAsset('dev-presets.js', new webpack.sources.RawSource(src))
				},
			)
		})
	}
}

module.exports = { buildDevPresets, DevPresetsPlugin }
