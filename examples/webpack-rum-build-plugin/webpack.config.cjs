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
const path = require('node:path')

const { SplunkRumWebpackPlugin } = require('@splunk/rum-build-plugins')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '.env') })

module.exports = {
	devtool: 'source-map',
	entry: {
		main: './src/main.ts',
	},
	mode: 'production',
	module: {
		rules: [
			{
				exclude: /node_modules/,
				test: /\.ts$/,
				use: 'ts-loader',
			},
		],
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist/cjs-config'),
	},
	plugins: [
		new SplunkRumWebpackPlugin({
			applicationName: 'webpack-rum-example',
			sourceMaps: {
				disableUpload: (process.env.SPLUNK_UPLOAD_SOURCE_MAPS ?? 'false') !== 'true',
				realm: process.env.SPLUNK_REALM,
				token: process.env.SPLUNK_SOURCE_MAPS_TOKEN,
			},
			version: '1.0.0-cjs',
		}),
	],
	resolve: {
		extensions: ['.ts', '.js'],
	},
}
