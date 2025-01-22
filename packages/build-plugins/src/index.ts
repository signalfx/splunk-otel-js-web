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

import { BannerPlugin, WebpackPluginInstance } from 'webpack'
import { computeSourceMapId, getCodeSnippet } from './utils'

// eslint-disable-next-line
export interface OllyWebPluginOptions {
	// define your plugin options here
}

const unpluginFactory: UnpluginFactory<OllyWebPluginOptions | undefined> = () => ({
	name: 'OllyWebPlugin',
	webpack(compiler) {
		compiler.hooks.thisCompilation.tap('OllyWebPlugin', () => {
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
				include: /\.(js|mjs)$/,
				raw: true,
			})
			bannerPlugin.apply(compiler)
		})
	},
})

const unplugin = createUnplugin(unpluginFactory)

export const ollyWebWebpackPlugin: (options: OllyWebPluginOptions) => WebpackPluginInstance = unplugin.webpack
