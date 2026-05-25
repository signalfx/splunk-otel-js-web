/**
 *
 * Copyright 2020-2026 Splunk Inc.
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
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'connect'))
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')

		expect(connectSpans).toHaveLength(1)
		expect(connectSpans[0].kind).toBe(3)
		expect(connectSpans[0]).toHaveSpanAttribute('app', 'splunk-otel-js-dummy-app')
		expect(connectSpans[0]).toHaveSpanAttribute('component', 'websocket')
		expect(connectSpans[0]).toNotHaveSpanAttribute('error')
		expect(connectSpans[0]).toHaveSpanAttribute('location.href', 'http://localhost:3000/websocket/websocket.ejs')
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('websocket url can be ignored', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-ignored.ejs')

		await recordPage.locator('#connectWs').click()
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'websocket-guard-span'))
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')
		expect(connectSpans).toHaveLength(0)
	})

	test('sending send and on message create a span', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket.ejs')

		await recordPage.locator('#connectWs').click()
		await recordPage.locator('#sendWs').click()

		await recordPage.waitForSpans(
			(spans) => spans.some((span) => span.name === 'send') && spans.some((span) => span.name === 'onmessage'),
		)
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')
		const messageSpans = recordPage.receivedSpans.filter((span) => span.name === 'onmessage')
		const sendSpans = recordPage.receivedSpans.filter((span) => span.name === 'send')

		expect(connectSpans).toHaveLength(1)

		expect(messageSpans).toHaveLength(1)
		expect(messageSpans[0].kind).toBe(5)
		expect(messageSpans[0]).toHaveSpanAttribute('component', 'websocket')
		expect(messageSpans[0]).toHaveSpanAttribute('protocol', '')
		expect(messageSpans[0]).toHaveSpanAttribute('http.url', 'ws://localhost:3000/ws')
		expect(messageSpans[0]).toHaveSpanAttribute('http.response_content_length', 14)

		expect(sendSpans).toHaveLength(1)
		expect(sendSpans[0].kind).toBe(4)
		expect(sendSpans[0]).toHaveSpanAttribute('component', 'websocket')
		expect(sendSpans[0]).toHaveSpanAttribute('protocol', '')
		expect(sendSpans[0]).toHaveSpanAttribute('http.url', 'ws://localhost:3000/ws')
		expect(sendSpans[0]).toHaveSpanAttribute('http.request_content_length', 12)
	})

	test('websocket constructor errors are captured', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-construct-errors.ejs')

		await recordPage.locator('#connectWs').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'connect'))
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')

		expect(connectSpans).toHaveLength(1)
		expect(connectSpans[0]).toHaveSpanAttribute('error', true)
	})

	test('websocket send errors are captured', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-send-errors.ejs')

		await recordPage.locator('#connectWs').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'send'))
		const sendSpans = recordPage.receivedSpans.filter((span) => span.name === 'send')

		expect(sendSpans).toHaveLength(1)
		expect(sendSpans[0]).toHaveSpanAttribute('error', true)
		expect(sendSpans[0]).toHaveSpanAttribute('error.message')
		expect(sendSpans[0]).toHaveSpanAttribute('error.object')
	})

	test('specifying sub-protocols does not break anything', async ({ recordPage }) => {
		await recordPage.goTo('/websocket/websocket-sub-protocol.ejs')

		await recordPage.locator('#connectWs').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'connect'))
		const connectSpans = recordPage.receivedSpans.filter((span) => span.name === 'connect')
		expect(connectSpans).toHaveLength(1)
		expect(connectSpans[0]).toHaveSpanAttribute(
			'location.href',
			'http://localhost:3000/websocket/websocket-sub-protocol.ejs',
		)
		expect(connectSpans[0]).toHaveSpanAttribute('protocols', '["soap"]')

		await recordPage.locator('#sendWs').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'onmessage'))
		const messageSpans = recordPage.receivedSpans.filter((span) => span.name === 'onmessage')

		expect(messageSpans).toHaveLength(1)
		expect(messageSpans[0].kind).toBe(5)
		expect(messageSpans[0]).toHaveSpanAttribute('component', 'websocket')
		expect(messageSpans[0]).toHaveSpanAttribute('protocol', 'soap')
		expect(messageSpans[0]).toHaveSpanAttribute('http.url', 'ws://localhost:3000/ws')
		expect(messageSpans[0]).toHaveSpanAttribute('http.response_content_length', 14)

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'send'))
		const sendSpans = recordPage.receivedSpans.filter((span) => span.name === 'send')

		expect(sendSpans).toHaveLength(1)
		expect(sendSpans[0].kind).toBe(4)
		expect(sendSpans[0]).toHaveSpanAttribute('component', 'websocket')
		expect(sendSpans[0]).toHaveSpanAttribute('protocol', 'soap')
		expect(sendSpans[0]).toHaveSpanAttribute('http.url', 'ws://localhost:3000/ws')
		expect(sendSpans[0]).toHaveSpanAttribute('http.request_content_length', 12)
	})
})
