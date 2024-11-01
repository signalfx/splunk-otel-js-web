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

module.exports = {
	'Connectivity events are captured': async function (browser) {
		// When we have a test run that supports chrome dev tools protocol we can properly emulate connectivity.
		// Otherwise this could be an unit test.
		// Should probably do some timing checks but don't want to add flakiness atm

		await browser.url(browser.globals.getUrl('/connectivity/connectivity.ejs'))

		await browser.globals.findSpan((span) => span.name === 'documentFetch')
		const connectivitySpans = browser.globals.getReceivedSpans().filter((span) => span.name === 'connectivity')
		await browser.assert.strictEqual(connectivitySpans.length, 0, 'No connectivity spans cause we are offline')

		await browser.globals.emulateOffline(true)
		let offlineSpan = await browser.globals.findSpan(
			(span) => span.name === 'connectivity' && span.tags['online'] === 'false',
		)
		let onlineSpan = await browser.globals.findSpan(
			(span) => span.name === 'connectivity' && span.tags['online'] === 'true',
		)

		await browser.assert.ok(!!onlineSpan, 'Offline span exists')
		await browser.assert.ok(!!offlineSpan, 'Online span exists')
		await browser.globals.assertNoErrorSpans()

		browser.globals.clearReceivedSpans()

		await browser.globals.emulateOffline(false)
		await browser.globals.emulateOffline(true)

		offlineSpan = await browser.globals.findSpan(
			(span) => span.name === 'connectivity' && span.tags['online'] === 'false',
		)
		onlineSpan = await browser.globals.findSpan(
			(span) => span.name === 'connectivity' && span.tags['online'] === 'true',
		)

		await browser.assert.ok(!!onlineSpan, 'Offline span exists')
		await browser.assert.ok(!!offlineSpan, 'Online span exists')

		await browser.globals.assertNoErrorSpans()
	},
}
