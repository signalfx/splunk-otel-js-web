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

exports.command = async function () {
	// 1. Require the `Saucelabs` npm module
	const SauceLabs = require('saucelabs')
	// 2. Instantiate the module
	const myAccount = new SauceLabs.default({
		user: process.env.SAUCE_USERNAME,
		key: process.env.SAUCE_ACCESS_KEY,
		region: process.env.REGION === 'eu' ? 'eu' : 'us',
	})
	// 3a. Get the sessionId
	const sessionId = this.sessionId
	// 3b. Get the jobName
	const jobName = this.currentTest.name
	// 3c. Get the status
	const passed = this.currentTest.results.testcases[jobName].passed > 0

	// 4. Update the status in Sauce Labs
	await myAccount.updateJob(process.env.SAUCE_USERNAME, sessionId, { passed: passed })

	// 5. Tell Nighwatch that we are done
	return this.end()
}
