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
import { expect } from '@playwright/test'
import { test } from '../../utils/test'

test.describe('websockets', () => {
	test('produces correct connect span', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket.ejs')

		await recordPage.locator('#connectWs').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'connect').length > 0)
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')

		expect(connectSpans).toHaveLength(1)
		expect(connectSpans[0].kind).toBe('CLIENT')
		expect(connectSpans[0].tags['app']).toBe('splunk-otel-js-dummy-app')
		expect(connectSpans[0].tags['component']).toBe('websocket')
		expect(connectSpans[0].tags['error']).toBeUndefined()
		expect(connectSpans[0].tags['location.href']).toBe('http://localhost:3000/websocket/websocket.ejs')
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('websocket url can be ignored', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-ignored.ejs')

		await recordPage.locator('#connectWs').click()
		await recordPage.waitForSpans(
			(spans) => spans.filter((span) => span.name === 'websocket-guard-span').length > 0,
		)
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')
		expect(connectSpans).toHaveLength(0)
	})

	test('sending send and on message create a span', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket.ejs')

		await recordPage.locator('#connectWs').click()
		await recordPage.locator('#sendWs').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'send').length > 0)
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')
		const messageSpans = recordPage.receivedSpans.filter((span) => span.name === 'onmessage')
		const sendSpans = recordPage.receivedSpans.filter((span) => span.name === 'send')

		expect(connectSpans).toHaveLength(1)

		expect(messageSpans).toHaveLength(1)
		expect(messageSpans[0].kind).toBe('CONSUMER')
		expect(messageSpans[0].tags['component']).toBe('websocket')
		expect(messageSpans[0].tags['protocol']).toBe('')
		expect(messageSpans[0].tags['http.url']).toBe('ws://localhost:3000/ws')
		expect(messageSpans[0].tags['http.response_content_length']).toBe('14')

		expect(sendSpans).toHaveLength(1)
		expect(sendSpans[0].kind).toBe('PRODUCER')
		expect(sendSpans[0].tags['component']).toBe('websocket')
		expect(sendSpans[0].tags['protocol']).toBe('')
		expect(sendSpans[0].tags['http.url']).toBe('ws://localhost:3000/ws')
		expect(sendSpans[0].tags['http.request_content_length']).toBe('12')
	})

	test('websocket constructor errors are captured', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-construct-errors.ejs')

		await recordPage.locator('#connectWs').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'connect').length > 0)
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')

		expect(connectSpans).toHaveLength(1)
		expect(connectSpans[0].tags['error']).toBe('true')
	})

	test('websocket send errors are captured', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-send-errors.ejs')

		await recordPage.locator('#connectWs').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'send').length > 0)
		const sendSpans = recordPage.receivedSpans.filter((span) => span.name === 'send')

		expect(sendSpans).toHaveLength(1)
		expect(sendSpans[0].tags['error']).toBe('true')
		expect(sendSpans[0].tags['error.message']).toBeDefined()
		expect(sendSpans[0].tags['error.object']).toBeDefined()
	})

	test('specifying sub-protocols does not break anything', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-sub-protocol.ejs')

		await recordPage.locator('#connectWs').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'connect').length > 0)
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')
		expect(connectSpans).toHaveLength(1)
		expect(connectSpans[0].tags['location.href']).toBe('http://localhost:3000/websocket/websocket-sub-protocol.ejs')
		expect(connectSpans[0].tags['protocols']).toBe('["soap"]')

		await recordPage.locator('#sendWs').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'onmessage').length > 0)
		const messageSpans = recordPage.receivedSpans.filter((span) => span.name === 'onmessage')

		expect(messageSpans).toHaveLength(1)
		expect(messageSpans[0].kind).toBe('CONSUMER')
		expect(messageSpans[0].tags['component']).toBe('websocket')
		expect(messageSpans[0].tags['protocol']).toBe('soap')
		expect(messageSpans[0].tags['http.url']).toBe('ws://localhost:3000/ws')
		expect(messageSpans[0].tags['http.response_content_length']).toBe('14')

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'send').length > 0)
		const sendSpans = recordPage.receivedSpans.filter((span) => span.name === 'send')

		expect(sendSpans).toHaveLength(1)
		expect(sendSpans[0].kind).toBe('PRODUCER')
		expect(sendSpans[0].tags['component']).toBe('websocket')
		expect(sendSpans[0].tags['protocol']).toBe('soap')
		expect(sendSpans[0].tags['http.url']).toBe('ws://localhost:3000/ws')
		expect(sendSpans[0].tags['http.request_content_length']).toBe('12')
	})
})
