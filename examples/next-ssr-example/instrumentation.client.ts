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
import SplunkOtelWeb from '@splunk/otel-web'
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

SplunkOtelWeb.init({
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_BEACON_ENDPOINT,
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
	applicationName: process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME,
	deploymentEnvironment: process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIROMENT,
})

void SplunkSessionRecorder.init({
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_SESSION_REPLAY_BEACON_ENDPOINT,
})
