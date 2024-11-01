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
	'handles form submit': async function (browser) {
		browser.globals.clearReceivedSpans()

		const startUrl = browser.globals.getUrl('/user-interaction/forms.ejs')
		await browser.url(startUrl)
		await browser.click('#btnSubmit')

		const submitSpan = await browser.globals.findSpan((span) => span.name === 'submit')
		await browser.assert.ok(!!submitSpan, 'Checking form submission span presence.')

		await browser.assert.strictEqual(submitSpan.tags['component'], 'user-interaction')
		await browser.assert.strictEqual(submitSpan.tags['event_type'], 'submit')
		await browser.assert.strictEqual(submitSpan.tags['target_element'], 'FORM')
		await browser.assert.strictEqual(submitSpan.tags['target_xpath'], '//*[@id="form1"]')

		await browser.globals.assertNoErrorSpans()
	},
}
