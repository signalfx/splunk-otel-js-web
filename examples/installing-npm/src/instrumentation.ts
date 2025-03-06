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

SplunkOtelWeb.init({
	beaconEndpoint: 'http://localhost:9101/api/v2/spans',
	debug: true,
	allowInsecureBeacon: true,
	applicationName: 'splunk-otel-web-example-npm',

	// uncomment to start sending to Splunk RUM backend
	// beaconEndpoint: 'https://rum-ingest.signalfx.com/api/v2/spans',

	// get the token by going to https://app.signalfx.com/#/organization/current?selectedKeyValue=sf_section:accesstokens
	rumAccessToken: 'ABC123...789',
})
