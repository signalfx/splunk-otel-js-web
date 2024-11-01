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
	'native session id integration': async function (browser) {
		const url = browser.globals.getUrl('/native/native.ejs')
		await browser.url(url)

		const anySpan = await browser.globals.findSpan((span) => span.tags['splunk.rumSessionId'] !== undefined)

		await browser.assert.ok(anySpan)

		await browser.assert.strictEqual(anySpan.tags['splunk.rumSessionId'], '12341234123412341234123412341234')
		await browser.globals.assertNoErrorSpans()
	},
}
