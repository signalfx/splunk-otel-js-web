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

test.describe('mouse', () => {
	test('handles mouse down/click/up', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/mouse.ejs')
		await recordPage.locator('#btn1').click()

		// TODO: Two click spans are being created. Investigate why.
		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'click'))
		const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
		const mouseDownSpan = recordPage.receivedSpans.find((span) => span.name === 'mousedown')
		const mouseUpSpan = recordPage.receivedSpans.find((span) => span.name === 'mouseup')

		for (const spanData of [
			{ name: 'click', span: clickSpan },
			{ name: 'mousedown', span: mouseDownSpan },
			{ name: 'mouseup', span: mouseUpSpan },
		]) {
			expect(spanData.span.tags['component']).toBe('user-interaction')
			expect(spanData.span.tags['event_type']).toBe(spanData.name)
			expect(spanData.span.tags['target_element']).toBe('BUTTON')
			expect(spanData.span.tags['target_xpath']).toBe('//*[@id="btn1"]')
		}

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('handles disabling of mouse events', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/mouse-disabled.ejs')
		await recordPage.locator('#btn1').click()
		await recordPage.locator('#btnGuard').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'guard').length === 1)
		const clickSpans = recordPage.receivedSpans.filter((span) => span.name === 'click')
		const mouseDownSpans = recordPage.receivedSpans.filter((span) => span.name === 'mousedown')
		const mouseUpSpans = recordPage.receivedSpans.filter((span) => span.name === 'mouseup')

		expect(clickSpans).toHaveLength(0)
		expect(mouseDownSpans).toHaveLength(0)
		expect(mouseUpSpans).toHaveLength(0)
	})

	test('handles clicks with event listener on document', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/mouse-document.ejs')
		await recordPage.locator('#btn1').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'click'))
		const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')

		expect(clickSpan.tags['component']).toBe('user-interaction')
		expect(clickSpan.tags['event_type']).toBe('click')
		expect(clickSpan.tags['target_element']).toBe('BUTTON')
		expect(clickSpan.tags['target_xpath']).toBe('//*[@id="btn1"]')
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('this is bubbled event is correct (open-telemetry/opentelemetry-js-contrib#643)', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/mouse-bubble.ejs')
		await recordPage.locator('#inner').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'click'))
		const resultElementText = await recordPage.locator('#result').textContent()

		expect(resultElementText).toBe('container')
		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('handles svg interactions', async ({ recordPage }) => {
		await recordPage.goTo('/user-interaction/mouse.ejs')
		await recordPage.locator('#btn-svg-target').click()

		await recordPage.waitForSpans((spans) => spans.some((span) => span.name === 'click'))
		const clickSpan = recordPage.receivedSpans.find((span) => span.name === 'click')
		const mouseDownSpan = recordPage.receivedSpans.find((span) => span.name === 'mousedown')
		const mouseUpSpan = recordPage.receivedSpans.find((span) => span.name === 'mouseup')

		for (const spanData of [
			{ name: 'click', span: clickSpan },
			{ name: 'mousedown', span: mouseDownSpan },
			{ name: 'mouseup', span: mouseUpSpan },
		]) {
			expect(spanData.span.tags['component']).toBe('user-interaction')
			expect(spanData.span.tags['event_type']).toBe(spanData.name)
			expect(spanData.span.tags['target_element']).toBe('rect')
			expect(spanData.span.tags['target_xpath']).toBe('//*[@id="btn-svg-target"]')
		}

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})
})
