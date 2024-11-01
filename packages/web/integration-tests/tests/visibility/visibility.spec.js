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
	'visibility events are captured': async function (browser) {
		await browser.url(browser.globals.getUrl('/visibility/visibility.ejs'))
		browser.globals.emulateTabSwitching(true)

		const tabHiddenSpan = await browser.globals.findSpan(
			(span) => span.name === 'visibility' && span.tags['hidden'] === 'true',
		)
		const hiddenSpans = browser.globals.getReceivedSpans().filter((span) => span.name === 'visibility')
		await browser.assert.ok(!!tabHiddenSpan, 'Visibility event for hidden tab exists')
		await browser.assert.strictEqual(hiddenSpans.length, 1, 'There is only one visibility event')

		browser.globals.clearReceivedSpans()

		browser.globals.emulateTabSwitching(false)
		const tabVisibileSpan = await browser.globals.findSpan(
			(span) => span.name === 'visibility' && span.tags['hidden'] === 'false',
		)
		const visibleSpans = browser.globals.getReceivedSpans().filter((span) => span.name === 'visibility')
		await browser.assert.ok(!!tabVisibileSpan, 'Visibility event for visible tab exists')
		await browser.assert.strictEqual(visibleSpans.length, 1, 'There is only one visibility event')

		await browser.globals.assertNoErrorSpans()
	},
}
