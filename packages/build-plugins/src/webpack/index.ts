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

import path from 'node:path'

import { AxiosError } from 'axios'
import type { Compiler } from 'webpack'

import type { SplunkRumPluginOptions } from '../index.js'

import { uploadFile } from '../http-utils.js'
import {
	computeSourceMapId,
	computeSourceMapIdFromFile,
	getCodeSnippet,
	getInsertIndexForCodeSnippet,
	getSourceMapUploadUrl,
	JS_FILE_REGEX,
	PLUGIN_NAME,
} from '../utils.js'

/**
 * The part of the webpack plugin responsible for injecting the sourceMapId code snippet into the JS bundles.
 */
export function applySourceMapsInject(compiler: Compiler) {
	const { webpack } = compiler
	const { Compilation } = webpack
	const { ReplaceSource } = webpack.sources as any

	/*
	 * The below implementation is based on webpack's native BannerPlugin implementation.
	 *
	 * BannerPlugin is not used here because:
	 *
	 *  - if the "//# sourceMappingURL=..." comment is present, we want to inject before that
	 *    (not just concat to end of file)
	 *
	 *  - we want to hash the source map contents to compute a consistent sourceMapId,
	 *    so this plugin must run after the PROCESS_ASSETS_STAGE_DEV_TOOLING stage of processAssets
	 *    (DEV_TOOLING is the stage when the source map asset should be added)
	 *
	 */
	const cache = new WeakMap()
	compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
		compilation.hooks.processAssets.tap(
			{
				name: PLUGIN_NAME,
				stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE, // the next stage after DEV_TOOLING
			},
			() => {
				for (const chunk of compilation.chunks) {
					for (const file of chunk.files) {
						if (!JS_FILE_REGEX.test(file)) {
							continue
						}

						const fileAsset = compilation.getAsset(file)
						if (!fileAsset) {
							continue
						}

						const sourceMap = fileAsset.info.related?.sourceMap
						if (typeof sourceMap !== 'string') {
							continue
						}

						const sourceMapAsset = compilation.getAsset(sourceMap)
						if (!sourceMapAsset) {
							continue
						}

						const sourceMapContent = sourceMapAsset.source.source()
						const sourceMapId = computeSourceMapId(sourceMapContent)
						const codeSnippet = getCodeSnippet(sourceMapId)

						compilation.updateAsset(file, (old) => {
							const cached = cache.get(old)
							if (!cached || cached.codeSnippet !== codeSnippet) {
								const index = getInsertIndexForCodeSnippet(old.source())
								const source = new ReplaceSource(old)
								source.insert(index, '\n' + codeSnippet)
								cache.set(old, { codeSnippet, source })
								return source
							}

							return cached.source
						})
					}
				}
			},
		)
	})
}

/**
 * The part of the webpack plugin responsible for uploading source maps from the output directory.
 */
export function applySourceMapsUpload(compiler: Compiler, options: SplunkRumPluginOptions): void {
	const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)

	compiler.hooks.afterEmit.tapAsync(PLUGIN_NAME, async (compilation, callback) => {
		/*
		 * find JS assets' related source map assets, and collect them to an array
		 */
		const sourceMaps: string[] = []
		compilation.assetsInfo.forEach((assetInfo, asset) => {
			if (JS_FILE_REGEX.test(asset) && typeof assetInfo?.related?.sourceMap === 'string') {
				sourceMaps.push(assetInfo.related.sourceMap)
			}
		})

		if (sourceMaps.length > 0) {
			logger.info(
				'Uploading %d source maps to %s',
				sourceMaps.length,
				options.sourceMaps && getSourceMapUploadUrl(options.sourceMaps.realm, '{id}'),
			)
		} else {
			logger.warn('No source maps found.')
			logger.warn('Make sure that source maps are enabled to utilize the %s plugin.', PLUGIN_NAME)
		}

		const uploadResults = {
			failed: 0,
			success: 0,
		}
		const parameters = Object.fromEntries(
			[
				['appName', options.applicationName],
				['appVersion', options.version],
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			].filter(([_, value]) => value !== undefined),
		)

		if (!options.sourceMaps) {
			return
		}

		/*
		 * resolve the source map assets to a file system path, then upload the files
		 */
		for (const sourceMap of sourceMaps) {
			const sourceMapPath = path.join(compiler.outputPath, sourceMap)
			const sourceMapId = await computeSourceMapIdFromFile(sourceMapPath)
			const url = getSourceMapUploadUrl(options.sourceMaps.realm, sourceMapId)

			logger.log('Uploading %s', sourceMap)
			logger.debug('PUT', url)
			try {
				logger.status(Array.from({ length: uploadResults.success }).fill('.').join(''))
				await uploadFile({
					file: {
						fieldName: 'file',
						filePath: sourceMapPath,
					},
					parameters,
					token: options.sourceMaps.token,
					url,
				})
				uploadResults.success += 1
			} catch (error) {
				uploadResults.failed += 1
				const ae = error as AxiosError

				const unableToUploadMessage = `Unable to upload ${sourceMapPath}`
				if (ae.response && ae.response.status === 413) {
					logger.warn(ae.response.status, ae.response.statusText)
					logger.warn(unableToUploadMessage)
				} else if (ae.response) {
					logger.error(ae.response.status, ae.response.statusText)
					logger.error(ae.response.data)
					logger.error(unableToUploadMessage)
				} else if (ae.request) {
					logger.error(`Response from ${url} was not received`)
					logger.error(ae.cause)
					logger.error(unableToUploadMessage)
				} else {
					logger.error(`Request to ${url} could not be sent`)
					logger.error(error)
					logger.error(unableToUploadMessage)
				}
			}
		}

		if (uploadResults.success > 0) {
			logger.info('Successfully uploaded %d source map(s)', uploadResults.success)
		}

		if (uploadResults.failed > 0) {
			logger.error('Failed to upload %d source map(s)', uploadResults.failed)
		}

		logger.status('Uploading finished\n')
		callback()
	})
}
