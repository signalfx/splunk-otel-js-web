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
import { BrowserContext, Page } from 'playwright'
import { Span } from '@opentelemetry/exporter-zipkin/build/src/types'

export class RecordPage {
	receivedSpans: Span[] = []

	get receivedErrorSpans() {
		return this.receivedSpans.filter((span) => span.name === 'onerror')
	}

	constructor(
		private readonly page: Page,
		private readonly context: BrowserContext,
	) {}

	changeVisibilityInTab = async (state: 'visible' | 'hidden') => {
		await this.page.evaluate((stateInner) => {
			Object.defineProperty(document, 'visibilityState', { value: stateInner, writable: true })
			Object.defineProperty(document, 'hidden', { value: Boolean(stateInner === 'hidden'), writable: true })

			window.dispatchEvent(new Event('visibilitychange'))
		}, state)
	}

	clearReceivedSpans() {
		this.receivedSpans = []
	}

	async flushData() {
		await this.page.evaluate(() => {
			if ((window as any).SplunkRum) {
				;(window as any).SplunkRum._processor.forceFlush()
			}
		})
	}

	async getCookie(name: string) {
		const cookies = await this.context.cookies()
		return cookies.find((cookie) => cookie.name === name)
	}

	goTo(url: string) {
		const absoluteUrl = new URL(url, 'http://localhost:3000').toString()
		return this.page.goto(absoluteUrl)
	}

	get locator() {
		return this.page.locator.bind(this.page)
	}

	get keyboard() {
		return this.page.keyboard
	}

	get evaluate() {
		return this.page.evaluate.bind(this.page)
	}

	async mockNetwork() {
		await this.page.route('*/**/api/v2/spans', async (route, request) => {
			const spans = JSON.parse(request.postData())
			this.receivedSpans.push(...spans)

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: '',
			})
		})
	}

	setOffline() {
		return this.context.setOffline(true)
	}

	setOnline() {
		return this.context.setOffline(false)
	}

	waitForSpans: (predicate: (spans: Span[]) => boolean) => Promise<void> = async (predicate) =>
		new Promise<void>((resolve) => {
			const intervalId = setInterval(async () => {
				await this.flushData()
				if (predicate(this.receivedSpans)) {
					clearInterval(intervalId)
					resolve()
				}
			}, 50)
		})

	waitForTestToFinish = async () => {
		await this.page.evaluate(
			() =>
				new Promise<void>((resolve) => {
					const interval = setInterval(() => {
						// TODO: Add d.ts file
						// @ts-expect-error testing is a global variable
						if (window.testing === false) {
							clearInterval(interval)
							resolve()
						}
					}, 50)
				}),
		)
	}

	waitForTimeout(timeout: number) {
		return this.page.waitForTimeout(timeout)
	}

	async waitForTimeoutAndFlushData(timeout: number) {
		await this.waitForTimeout(timeout)
		await this.flushData()
	}
}
