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
	'produces correct connect span': async function (browser) {
		const url = browser.globals.getUrl('/socketio/socketio.ejs')
		await browser.url(url)

		await browser.click('#connectSocket')
		await browser.click('#sendHello')
		await browser.click('#sendPing')

		await browser.globals.waitForTestToFinish()
		await browser.globals.findSpan((span) => span.name === 'pong receive')

		const sioSpans = await browser.globals
			.getReceivedSpans()
			.filter((span) => span.tags['messaging.system'] === 'socket.io')

		await browser.assert.strictEqual(sioSpans.length, 3)

		await browser.assert.strictEqual(sioSpans[0].name, 'hello send')
		await browser.assert.strictEqual(sioSpans[1].name, 'ping send')
		await browser.assert.strictEqual(sioSpans[2].name, 'pong receive')
	},
	'produces correct connect span (socket.io already on page)': async function (browser) {
		const url = browser.globals.getUrl('/socketio/socketio.before.ejs')
		await browser.url(url)

		await browser.click('#connectSocket')
		await browser.click('#sendHello')
		await browser.click('#sendPing')

		await browser.globals.waitForTestToFinish()
		await browser.globals.findSpan((span) => span.name === 'pong receive')

		const sioSpans = await browser.globals
			.getReceivedSpans()
			.filter((span) => span.tags['messaging.system'] === 'socket.io')

		await browser.assert.strictEqual(sioSpans.length, 3)

		await browser.assert.strictEqual(sioSpans[0].name, 'hello send')
		await browser.assert.strictEqual(sioSpans[1].name, 'ping send')
		await browser.assert.strictEqual(sioSpans[2].name, 'pong receive')
	},
}
