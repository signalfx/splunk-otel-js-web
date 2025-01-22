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
import { createUnplugin, UnpluginFactory } from 'unplugin'

import type { WebpackPluginInstance } from 'webpack'
import { computeSourceMapId, getCodeSnippet, JS_FILE_REGEX, PLUGIN_NAME } from './utils'
import { applySourceMapsUpload } from './webpack'

export interface OllyWebPluginOptions {
	/** Plugin configuration for source map ID injection and source map file uploads */
	sourceMaps: {
		/** Optional. If provided, this should match the "applicationName" used where SplunkRum.init() is called. */
		applicationName?: string

		/** Optional. If true, the plugin will inject source map IDs into the final JavaScript bundles, but it will not upload any source map files. */
		disableUpload?: boolean

		/** the Splunk Observability realm */
		realm: string

		/** API token used to authenticate the file upload requests.  This is not the same as the rumAccessToken used in SplunkRum.init(). */
		token: string

		/** Optional. If provided, this should match the "version" used where SplunkRum.init() is called. */
		version?: string
	}
}

const unpluginFactory: UnpluginFactory<OllyWebPluginOptions | undefined> = (options) => ({
	name: PLUGIN_NAME,
	webpack(compiler) {
		const { webpack } = compiler
		const { BannerPlugin } = webpack
		compiler.hooks.thisCompilation.tap(PLUGIN_NAME, () => {
			const bannerPlugin = new BannerPlugin({
				banner: ({ chunk }) => {
					if (!chunk.hash) {
						return ''
					}

					const sourceMapId = computeSourceMapId(chunk.hash)
					return getCodeSnippet(sourceMapId)
				},
				entryOnly: false,
				footer: true,
				include: JS_FILE_REGEX,
				raw: true,
			})
			bannerPlugin.apply(compiler)
		})

		if (!options.sourceMaps.disableUpload) {
			applySourceMapsUpload(compiler, options)
		}
	},
})

const unplugin = createUnplugin(unpluginFactory)

export const ollyWebWebpackPlugin: (options: OllyWebPluginOptions) => WebpackPluginInstance = unplugin.webpack
