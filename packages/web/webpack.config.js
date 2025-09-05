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

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const artifactsPath = path.resolve(__dirname, './dist/artifacts')

const getBaseConfig = (env, argv, options = {}) => {
	const isDevelopmentMode = argv.mode === 'development'
	const isLegacyBuild = options.isLegacyBuild === true

	return {
		devtool: isDevelopmentMode ? 'inline-source-map' : 'source-map',
		module: {
			rules: [
				{
					exclude: /node_modules/,
					test: /\.tsx?$/,
					use: [
						{
							loader: 'swc-loader',
							options: {
								env: {
									coreJs: isLegacyBuild ? '3.42' : undefined,
									mode: isLegacyBuild ? 'usage' : undefined,
									targets: isLegacyBuild
										? 'defaults, chrome >= 50, safari >= 11, firefox >= 50, ie >= 11'
										: 'defaults, chrome >= 71, safari >= 12.1, firefox >= 65',
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
				// For legacy builds, we need to transpile OpenTelemetry packages to ES5
				{
					include: isLegacyBuild ? /node_modules\/@opentelemetry\// : [],
					test: /\.m?js$/,
					use: [
						{
							loader: 'swc-loader',
							options: {
								jsc: {
									parser: {
										syntax: 'ecmascript',
									},
									target: 'es5',
								},
							},
						},
					],
				},
				{
					enforce: 'pre',
					test: /\.js$/,
					use: ['source-map-loader'],
				},
			],
		},
		optimization: {
			minimize: true,
			minimizer: [
				new TerserPlugin({
					extractComments: false,
					terserOptions: {
						ecma: isLegacyBuild ? 5 : 6,
						format: {
							comments: false,
						},
					},
				}),
			],
		},
		output: {
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
			iife: true,
			path: artifactsPath,
		},
		plugins: [
			new ForkTsCheckerWebpackPlugin({
				typescript: {
					configFile: 'tsconfig.base.json',
					diagnosticOptions: { semantic: true, syntactic: true },
				},
			}),
		],
		resolve: {
			extensions: ['.ts', '.js', '.json'],
		},
	}
}

const browserConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		entry: path.resolve(__dirname, './src/index-browser.ts'),
		output: {
			...baseConfig.output,
			filename: 'splunk-otel-web.js',
			library: {
				export: 'default',
				name: 'SplunkRum',
				type: 'window',
			},
		},
	}
}

const browserLegacyConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv, { isLegacyBuild: true })
	return {
		...baseConfig,
		entry: [path.resolve(__dirname, './src/polyfills/index.ts'), path.resolve(__dirname, './src/index-browser.ts')],
		output: {
			...baseConfig.output,
			filename: 'splunk-otel-web-legacy.js',
			library: {
				export: 'default',
				name: 'SplunkRum',
				type: 'window',
			},
		},
	}
}

const otelApiGlobalsConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		entry: path.resolve(__dirname, './src/otel-api-globals.ts'),
		output: {
			...baseConfig.output,
			filename: 'otel-api-globals.js',
			library: {
				name: 'OtelApiGlobals',
				type: 'window',
			},
		},
	}
}

module.exports = [browserConfig, browserLegacyConfig, otelApiGlobalsConfig]
