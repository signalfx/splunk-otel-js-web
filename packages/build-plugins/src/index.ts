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

import type { Compiler, WebpackPluginInstance } from 'webpack'
import { PLUGIN_NAME } from './utils'
import { applySourceMapsInject, applySourceMapsUpload } from './webpack'

export interface SplunkRumPluginOptions {
	/** Optional. If provided, this should match the "applicationName" used where SplunkRum.init() is called. */
	applicationName?: string

	/** Plugin configuration for source map ID injection and source map file uploads */
	sourceMaps?: {
		/** Optional. If true, the plugin will inject source map IDs into the final JavaScript bundles, but it will not upload any source map files. */
		disableUpload?: boolean

		/** the Splunk Observability realm */
		realm: string

		/** API token used to authenticate the file upload requests.  This is not the same as the rumAccessToken used in SplunkRum.init(). */
		token: string
	}

	/** Optional. If provided, this should match the "version" used where SplunkRum.init() is called. */
	version?: string
}

const unpluginFactory: UnpluginFactory<SplunkRumPluginOptions | undefined> = (options) => ({
	name: PLUGIN_NAME,
	webpack(compiler) {
		const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)

		if (!options) {
			return
		}

		if (options.sourceMaps) {
			applySourceMapsInject(compiler)

			let shouldApplySourceMapsUpload = true
			if (options.sourceMaps.disableUpload) {
				logger.debug('sourceMaps.disableUpload is set — skipping source map uploads')
				shouldApplySourceMapsUpload = false
			} else if (!options.sourceMaps.realm) {
				logger.warn('sourceMaps.realm is missing — skipping source map uploads')
				shouldApplySourceMapsUpload = false
			} else if (!options.sourceMaps.token) {
				logger.warn('sourceMaps.token is missing — skipping source map uploads')
				shouldApplySourceMapsUpload = false
			}

			if (shouldApplySourceMapsUpload) {
				applySourceMapsUpload(compiler, options)
			}
		}
	},
})

const unplugin = createUnplugin(unpluginFactory)

export class SplunkRumWebpackPlugin {
	// unplugin.webpack gives us a function
	// Wrap it in this exported class so that usages of our plugin follow the convention of other webpack plugins,
	// which use the "new" keyword to create instances of plugins

	private unpluginInstance: WebpackPluginInstance

	constructor(options: SplunkRumPluginOptions) {
		this.unpluginInstance = unplugin.webpack(options)
	}

	apply(compiler: Compiler): void {
		this.unpluginInstance.apply(compiler)
	}
}
