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
const path = require('path')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const getBaseConfig = (env, argv) => {
	const isDevelopmentMode = argv.mode === 'development'

	return {
		entry: path.resolve(__dirname, './src/index.ts'),
		resolve: {
			extensions: ['.ts', '.js', '.json'],
		},
		devtool: isDevelopmentMode ? 'inline-source-map' : 'source-map',
		experiments: {
			buildHttp: {
				allowedUris: ['https://cdn.signalfx.com/'],
				cacheLocation: false,
				frozen: true,
			},
		},
	}
}

const browserConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		output: {
			crossOriginLoading: 'anonymous',
			filename: 'splunk-otel-web-session-recorder.js',
			path: path.resolve(__dirname, './dist/artifacts'),
			library: {
				name: 'SplunkSessionRecorder',
				type: 'window',
				export: 'default',
			},
			iife: true,
			clean: true,
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
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					exclude: /node_modules/,
					use: {
						loader: 'swc-loader',
						options: {
							jsc: {
								parser: {
									syntax: 'typescript',
								},
								externalHelpers: true,
							},
							env: {
								targets: 'defaults, chrome >= 71, safari >= 12.1, firefox >= 65',
								mode: 'usage',
								coreJs: '3.42',
							},
						},
					},
				},
				{
					test: /\.js$/,
					enforce: 'pre',
					use: ['source-map-loader'],
				},
			],
		},
		plugins: [
			new ForkTsCheckerWebpackPlugin({
				typescript: {
					configFile: 'tsconfig.base.json',
					diagnosticOptions: { semantic: true, syntactic: true },
				},
			}),
		],
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
	}
}

const libraryConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		output: {
			filename: 'index.js',
			path: path.resolve(__dirname, './dist/lib'),
			library: {
				type: 'commonjs-static',
			},
			clean: true,
		},
		module: {
			rules: [
				{
					test: /\.ts$/,
					loader: 'ts-loader',
					exclude: /node_modules/,
					options: { configFile: 'tsconfig.esm.json' },
				},
				{
					test: /\.js$/,
					enforce: 'pre',
					use: ['source-map-loader'],
				},
			],
		},
	}
}

module.exports = [browserConfig, libraryConfig]
