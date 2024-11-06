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
	'beforeEach': function (browser) {
		browser.globals.clearReceivedSpans()
	},
	'handles causality of a mouse click': async function (browser) {
		await browser.url(browser.globals.getUrl('/user-interaction/causality.ejs'))

		// Do a click so web-vitals can run and then remove it's event listeners
		await browser.click('body')

		await browser.click('#btn1')

		const clickSpan = await browser.globals.findSpan(
			(span) => span.name === 'click' && span.tags['target_xpath'] === '//*[@id="btn1"]',
		)
		await browser.assert.ok(!!clickSpan, 'Checking click span presence.')

		const fetchSpan = await browser.globals.findSpan(
			(span) => span.tags['http.url'] === browser.globals.getUrl('/some-data', []),
		)
		await browser.assert.ok(!!fetchSpan, 'Checking fetch span presence.')

		await browser.assert.not.ok(clickSpan.parentId, 'Click span does not have a parent.')
		await browser.assert.strictEqual(
			fetchSpan.parentId,
			clickSpan.id,
			'Fetch span belongs to user interaction trace.',
		)

		await browser.globals.assertNoErrorSpans()
	},
	'can be disabled': async function (browser) {
		await browser.url(browser.globals.getUrl('/user-interaction/causality.ejs'))
		await browser.click('#btn1')
		await browser.globals.waitForTestToFinish()

		browser.assert.ok(
			!!(await browser.globals.getReceivedSpans().find(({ name }) => name === 'click')),
			'click span recorded',
		)

		browser.globals.clearReceivedSpans()
		await browser.url(browser.globals.getUrl('/user-interaction/causality.ejs?disableInstrumentation=interactions'))
		await browser.click('#btn1')
		await browser.globals.waitForTestToFinish()

		browser.assert.not.ok(
			await browser.globals.getReceivedSpans().find(({ name }) => name === 'click'),
			'lack of click span',
		)
	},
}
