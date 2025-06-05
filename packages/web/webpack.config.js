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

const artifactsPath = path.resolve(__dirname, './dist/artifacts')

const getBaseConfig = (env, argv, options = {}) => {
	const isDevelopmentMode = argv.mode === 'development'
	const isLegacyBuild = options.isLegacyBuild === true

	return {
		output: {
			crossOriginLoading: 'anonymous',
			path: artifactsPath,
			iife: true,
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
		resolve: {
			extensions: ['.ts', '.js', '.json'],
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					exclude: /node_modules/,
					use: [
						{
							loader: 'swc-loader',
							options: {
								jsc: {
									parser: {
										syntax: 'typescript',
									},
									externalHelpers: true,
								},
								env: {
									targets: isLegacyBuild
										? 'defaults, chrome >= 50, safari >= 11, firefox >= 50, ie >= 11'
										: 'defaults, chrome >= 71, safari >= 12.1, firefox >= 65',
									mode: isLegacyBuild ? 'usage' : undefined,
									coreJs: isLegacyBuild ? '3.42' : undefined,
								},
							},
						},
					],
				},
				// For legacy builds, we need to transpile OpenTelemetry packages to ES5
				{
					test: /\.m?js$/,
					include: isLegacyBuild ? /node_modules\/@opentelemetry\// : [],
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
		devtool: isDevelopmentMode ? 'inline-source-map' : 'source-map',
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
	}
}

const browserConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		entry: path.resolve(__dirname, './src/indexBrowser.ts'),
		output: {
			...baseConfig.output,
			filename: 'splunk-otel-web.js',
			library: {
				name: 'SplunkRum',
				type: 'window',
				export: 'default',
			},
		},
	}
}

const browserLegacyConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv, { isLegacyBuild: true })
	return {
		...baseConfig,
		entry: [path.resolve(__dirname, './src/polyfills/index.ts'), path.resolve(__dirname, './src/indexBrowser.ts')],
		output: {
			...baseConfig.output,
			filename: 'splunk-otel-web-legacy.js',
			library: {
				name: 'SplunkRum',
				type: 'window',
				export: 'default',
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
