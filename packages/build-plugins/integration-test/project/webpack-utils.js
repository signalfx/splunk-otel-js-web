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
module.exports = {
	getBaseConfig: (configFilename) => ({
		entry: {
			main: './src/index.js',
			other: './src/other-entry.js',
		},
		output: {
			filename: '[name].js',
			path: path.resolve(__dirname, 'dist/' + path.basename(configFilename).replaceAll('.', '-')),
		},
		mode: 'production',
	}),
}
