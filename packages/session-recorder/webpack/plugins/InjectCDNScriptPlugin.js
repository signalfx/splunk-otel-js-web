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
const webpack = require('webpack')

const PLUGIN_NAME = 'InjectCDNScriptPlugin'

class InjectCDNScriptPlugin {
	constructor(options) {
		this.url = options.url
		this.targetAsset = options.targetAsset
	}

	apply(compiler) {
		if (!this.url) {
			throw new Error('Missing required option: url')
		}

		compiler.hooks.thisCompilation.tap(PLUGIN_NAME, async (compilation) => {
			const logger = compilation.getLogger(PLUGIN_NAME)

			logger.log('📦 Fetching script from CDN: ', this.url)

			compilation.hooks.processAssets.tapAsync(
				{
					name: 'InjectCDNScriptPlugin',
					stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
				},
				async (assets, callback) => {
					try {
						const response = await fetch(this.url)
						if (!response.ok) {
							throw new Error(`Network response was not ok: ${response.statusText}`)
						}

						const scriptContent = await response.text()

						// Inject the fetched script into the target asset
						if (assets[this.targetAsset]) {
							const originalSource = assets[this.targetAsset].source()
							const newSource = `${scriptContent}\n\n${originalSource}`

							// Update the asset with the new source
							compilation.updateAsset(this.targetAsset, new webpack.sources.RawSource(newSource))
						} else {
							logger.warn(`Asset ${this.targetAsset} not found in the compilation.`)
						}

						callback()
					} catch (error) {
						logger.error('Error fetching script from CDN:', error)
						callback(error)
					}
				},
			)
		})
	}
}

exports.InjectCDNScriptPlugin = InjectCDNScriptPlugin
