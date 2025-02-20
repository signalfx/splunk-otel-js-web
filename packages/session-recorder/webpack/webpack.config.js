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
const { fileURLToPath } = require('url')
const TerserPlugin = require('terser-webpack-plugin')

const { InjectCDNScriptPlugin } = require('./plugins/InjectCDNScriptPlugin')

const outputAssetName = 'splunk-otel-web-session-recorder.js'

module.exports = {
	mode: 'production',
	entry: path.resolve(__dirname, '../src/index.ts'),
	output: {
		crossOriginLoading: 'anonymous',
		filename: outputAssetName,
		path: path.resolve(__dirname, '../dist/artifacts'),
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
	resolve: {
		extensions: ['.ts', '.js', '.json'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader',
				exclude: /node_modules/,
				options: { configFile: 'tsconfig.base.json' },
			},
			{
				test: /\.js$/,
				enforce: 'pre',
				use: ['source-map-loader'],
			},
		],
	},
	// plugins: [
	// 	new InjectCDNScriptPlugin(
	// 		'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/v1.30.0/session-replay.module.min.js',
	// 		outputAssetName,
	// 	),
	// ],
	devtool: 'source-map',
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				extractComments: false,
				terserOptions: {
					format: {
						comments: false,
					},
				},
			}),
		],
	},
}
