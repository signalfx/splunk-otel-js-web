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
import { test } from '../../utils/test'
import { expect } from '@playwright/test'

test.describe('socketio', () => {
	test('produces correct connect span', async ({ recordPage }) => {
		await recordPage.goTo('/socketio/socketio.ejs')
		await recordPage.locator('#connectSocket').click()
		await recordPage.locator('#sendHello').click()
		await recordPage.locator('#sendPing').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'pong receive').length > 0)
		const socketioSpans = recordPage.receivedSpans.filter((span) => span.tags['messaging.system'] === 'socket.io')

		expect(socketioSpans).toHaveLength(3)
		expect(socketioSpans[0].name).toBe('hello send')
		expect(socketioSpans[1].name).toBe('ping send')
		expect(socketioSpans[2].name).toBe('pong receive')
	})

	test('produces correct connect span (socket.io already on page)', async ({ recordPage }) => {
		await recordPage.goTo('/socketio/socketio.before.ejs')
		await recordPage.locator('#connectSocket').click()
		await recordPage.locator('#sendHello').click()
		await recordPage.locator('#sendPing').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'pong receive').length > 0)
		const socketioSpans = recordPage.receivedSpans.filter((span) => span.tags['messaging.system'] === 'socket.io')

		expect(socketioSpans).toHaveLength(3)
		expect(socketioSpans[0].name).toBe('hello send')
		expect(socketioSpans[1].name).toBe('ping send')
		expect(socketioSpans[2].name).toBe('pong receive')
	})
})
