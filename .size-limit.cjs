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
module.exports = [
	{
		name: 'artifacts/otel-api-globals.js',
		limit: '3 kB',
		path: './packages/web/dist/artifacts/otel-api-globals.js',
	},

	{
		name: 'artifacts/splunk-otel-web.js',
		limit: '45 kB',
		path: './packages/web/dist/artifacts/splunk-otel-web.js',
	},

	{
		name: 'artifacts/splunk-otel-web-legacy.js',
		limit: '105 kB',
		path: './packages/web/dist/artifacts/splunk-otel-web-legacy.js',
	},

	{
		name: 'artifacts/splunk-otel-web-session-recorder.js',
		limit: '109 kB',
		path: './packages/session-recorder/dist/artifacts/splunk-otel-web-session-recorder.js',
	},
]
