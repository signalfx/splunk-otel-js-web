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
	'XHR request can be ignored': async function (browser) {
		await browser.url(browser.globals.getUrl('/xhr/views/xhr-ignored.ejs'))

		await browser.globals.findSpan((span) => span.name === 'guard-span')

		await browser.assert.not.ok(
			browser.globals.getReceivedSpans().find((span) => span.tags['http.url'] === '/some-data'),
		)
		await browser.assert.not.ok(
			browser.globals.getReceivedSpans().find((span) => span.tags['http.url'] === '/no-server-timings'),
		)
	},
}
