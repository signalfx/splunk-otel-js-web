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
import SplunkOtelWeb from '@splunk/otel-web'
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

// Read configuration from environment variables (injected by webpack)
const realm = process.env.SPLUNK_RUM_REALM
const rumAccessToken = process.env.SPLUNK_RUM_ACCESS_TOKEN
const applicationName = process.env.SPLUNK_RUM_APPLICATION_NAME || 'splunk-otel-electron-example'
const deploymentEnvironment = process.env.SPLUNK_RUM_ENVIRONMENT || 'development'
const debug = process.env.SPLUNK_RUM_DEBUG === 'true'

SplunkOtelWeb.init({
	applicationName,
	debug,
	deploymentEnvironment,
	persistence: 'localStorage',
	realm,
	rumAccessToken,
})

SplunkSessionRecorder.init({
	debug,
	realm,
	rumAccessToken,
})

console.log(`✅ Splunk RUM and Session Recorder initialized for Electron`)
