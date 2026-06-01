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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FetchXhrMonitor } from './fetch-xhr-monitor'
import { ResourceState, ResourceStateEvent } from './monitor'

describe('FetchXhrMonitor', () => {
	let monitor: FetchXhrMonitor
	let events: ResourceStateEvent[]

	beforeEach(() => {
		events = []
		monitor = new FetchXhrMonitor({
			ignoreUrls: [/ignore-me/],
			onResourceStateChange: (event) => events.push(event),
		})
		monitor.start()
	})

	afterEach(() => {
		monitor.stop()
	})

	describe('fetch', () => {
		it('tracks fetch requests', async () => {
			// Use data URL for reliable test
			await fetch('data:text/plain,hello')

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[1]).toHaveProperty('loadTime')
			expect(events[0].id).toBe(events[1].id)
		})

		it('ignores URLs matching pattern', async () => {
			await fetch('data:text/plain,ignore-me-test')

			expect(events.length).toBe(0)
		})
	})

	describe('XHR', () => {
		it('tracks XHR requests', async () => {
			await new Promise<void>((resolve) => {
				const xhr = new XMLHttpRequest()
				xhr.open('GET', 'data:text/plain,hello')
				xhr.addEventListener('load', () => resolve())
				xhr.addEventListener('error', () => resolve())
				xhr.send()
			})

			// Allow microtasks to complete so monitor's event handlers are processed
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[1]).toHaveProperty('loadTime')
		})

		it('ignores URLs matching pattern', async () => {
			await new Promise<void>((resolve) => {
				const xhr = new XMLHttpRequest()
				xhr.open('GET', 'data:text/plain,ignore-me-test')
				xhr.addEventListener('load', () => resolve())
				xhr.addEventListener('error', () => resolve())
				xhr.send()
			})

			expect(events.length).toBe(0)
		})
	})

	describe('maxResourceWaitingTime', () => {
		const HTTP_SERVER = 'http://127.0.0.1:8981'

		it('emits TIMEOUT for resource that exceeds maxResourceWaitingTime', async () => {
			monitor.stop()
			events = []
			monitor = new FetchXhrMonitor({
				maxResourceWaitingTime: 100,
				onResourceStateChange: (event) => events.push(event),
			})
			monitor.start()

			fetch(`${HTTP_SERVER}/delay?delay=5000`).catch(() => {})

			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(events.some((e) => e.state === ResourceState.TIMEOUT)).toBe(true)
			const timeoutEvent = events.find((e) => e.state === ResourceState.TIMEOUT)
			expect(timeoutEvent?.url).toBe(`${HTTP_SERVER}/delay?delay=5000`)
		})

		it('does not emit TIMEOUT if resource completes in time', async () => {
			monitor.stop()
			events = []
			monitor = new FetchXhrMonitor({
				maxResourceWaitingTime: 500,
				onResourceStateChange: (event) => events.push(event),
			})
			monitor.start()

			await fetch(`${HTTP_SERVER}/delay?delay=10`)

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(events.some((e) => e.state === ResourceState.TIMEOUT)).toBe(false)
		})
	})

	describe('start/stop', () => {
		it('stops tracking after stop()', async () => {
			monitor.stop()

			await fetch('data:text/plain,hello')

			expect(events.length).toBe(0)
		})

		it('restarts monitoring', async () => {
			monitor.stop()
			monitor.start()

			await fetch('data:text/plain,hello')

			expect(events.length).toBe(2)
		})
	})
})
