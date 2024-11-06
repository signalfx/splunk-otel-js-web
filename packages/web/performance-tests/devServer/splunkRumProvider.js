/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const path = require('path')
const fs = require('fs')
const { render } = require('ejs')

const SPLUNK_RUM_TAGS_TEMPLATE = `
<script src="<%= file -%>"></script>
<script>
  window.SplunkRum && window.SplunkRum.init(<%- options -%>)
</script>
`

const LIB_DISK_PATH = path.join(__dirname, '..', '..', 'dist', 'splunk-otel-web.js')
const LIB_PATH = '/bundles/splunk-rum'

async function handleSplunkRumRequest(app) {
	app.get(LIB_PATH, (_, res) => {
		res.set({
			'Content-Type': 'text/javascript',
		})
		res.send(getSplunkRumContent())
	})
}

function generateSplunkRumTags() {
	const options = {
		beaconEndpoint: '/api/v2/spans',
		applicationName: 'splunk-otel-js-dummy-app',
		debug: false,
	}

	return render(SPLUNK_RUM_TAGS_TEMPLATE, {
		file: '/dist/artifacts/splunk-otel-web.js',
		options: JSON.stringify(options),
	})
}

function getSplunkRumContent() {
	return fs.readFileSync(LIB_DISK_PATH)
}

module.exports = {
	handleSplunkRumRequest,
	generateSplunkRumTags,
	getSplunkRumContent,
}
