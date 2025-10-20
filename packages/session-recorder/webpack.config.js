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
const path = require('node:path')

const CopyWebpackPlugin = require('copy-webpack-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const getBaseConfig = (env, argv) => {
	const isDevelopmentMode = argv.mode === 'development'

	return {
		devtool: isDevelopmentMode ? 'inline-source-map' : 'source-map',
		entry: path.resolve(__dirname, './src/index.ts'),
		experiments: {
			buildHttp: {
				allowedUris: ['https://cdn.signalfx.com/'],
				cacheLocation: false,
				frozen: true,
			},
		},
		module: {
			rules: [
				{
					generator: {
						filename: 'background-service.html',
					},
					test: /\.html$/,
					type: 'asset/resource',
				},
				{
					enforce: 'pre',
					test: /\.js$/,
					use: ['source-map-loader'],
				},
			],
		},
		resolve: {
			extensions: ['.ts', '.js', '.json'],
		},
	}
}

const browserConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		module: {
			rules: [
				...baseConfig.module.rules,
				{
					exclude: /node_modules/,
					test: /\.(ts|js)$/,
					use: [
						{
							loader: 'swc-loader',
							options: {
								env: {
									coreJs: '3.45.1',
									mode: 'usage',
									targets: ['defaults', 'chrome >= 71', 'firefox >= 65', 'safari >= 12.1'],
								},
								jsc: {
									externalHelpers: true,
									parser: {
										syntax: 'typescript',
									},
								},
							},
						},
					],
				},
			],
		},
		optimization: {
			minimize: true,
			minimizer: [
				new TerserPlugin({
					extractComments: false,
					terserOptions: {
						ecma: 6,
						format: {
							comments: false,
						},
					},
				}),
			],
		},
		output: {
			clean: true,
			crossOriginLoading: 'anonymous',
			environment: {
				// without this line, webpack would wrap our code to an arrow function
				arrowFunction: false,
				bigIntLiteral: false,
				const: false,
				destructuring: false,
				dynamicImport: false,
				forOf: false,
				module: false,
			},
			filename: 'splunk-otel-web-session-recorder.js',
			iife: true,
			library: {
				export: 'default',
				name: 'SplunkSessionRecorder',
				type: 'window',
			},
			path: path.resolve(__dirname, './dist/artifacts'),
		},
		plugins: [
			new ForkTsCheckerWebpackPlugin({
				typescript: {
					configFile: 'tsconfig.base.json',
					diagnosticOptions: { semantic: true, syntactic: true },
				},
			}),
		],
	}
}

const cjsConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		module: {
			rules: [
				...baseConfig.module.rules,
				{
					exclude: /node_modules/,
					loader: 'ts-loader',
					options: { configFile: 'tsconfig.cjs.json' },
					test: /\.ts$/,
				},
			],
		},
		output: {
			clean: true,
			filename: 'index.js',
			library: {
				type: 'commonjs2',
			},
			path: path.resolve(__dirname, './dist/cjs'),
		},
		plugins: [
			new CopyWebpackPlugin({
				patterns: [
					{
						from: 'src/session-replay/cdn-module-types.d.ts',
						to: 'session-replay/cdn-module-types.d.ts',
					},
				],
			}),
		],
	}
}

const esmConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		experiments: {
			...baseConfig.experiments,
			outputModule: true,
		},
		module: {
			rules: [
				...baseConfig.module.rules,
				{
					exclude: /node_modules/,
					loader: 'ts-loader',
					options: { configFile: 'tsconfig.esm.json' },
					test: /\.ts$/,
				},
			],
		},
		output: {
			clean: true,
			filename: 'index.js',
			library: {
				type: 'module',
			},
			path: path.resolve(__dirname, './dist/esm'),
		},
		plugins: [
			new CopyWebpackPlugin({
				patterns: [
					{
						from: 'src/session-replay/cdn-module-types.d.ts',
						to: 'session-replay/cdn-module-types.d.ts',
					},
				],
			}),
		],
	}
}

module.exports = [browserConfig, cjsConfig, esmConfig]
