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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HTTP_TEST_SERVER_URL } from '../../../../../../tests/servers/http-constants'
import { FetchXhrMonitor } from './fetch-xhr-monitor'
import { ResourceState, ResourceStateEvent } from './monitor'

describe('FetchXhrMonitor', () => {
	let monitor: FetchXhrMonitor
	let events: ResourceStateEvent[]

	beforeEach(() => {
		events = []
		monitor = new FetchXhrMonitor({
			onResourceStateChange: (event) => events.push(event),
		})
		monitor.start()
	})

	afterEach(() => {
		monitor.stop()
	})

	describe('fetch', () => {
		it('tracks fetch requests', async () => {
			await fetch(`${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=fetch-track`)

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[1]).toHaveProperty('loadTime')
			expect(events[0].id).toBe(events[1].id)
		})

		it('emits URLs matching ignore patterns because NavigationMetricsManager applies ignoreUrls', async () => {
			await fetch(`${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=ignore-me-test`)

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})

		it('tracks data URL requests', async () => {
			await fetch('data:text/plain,hello')

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})

		it('waits for the response body without delaying the original response', async () => {
			replaceMonitor({ waitForFetchResponseBody: true })
			let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined
			const restoreFetch = replaceFetch(() =>
				Promise.resolve(
					new Response(
						new ReadableStream<Uint8Array>({
							start(controller) {
								bodyController = controller
								controller.enqueue(new TextEncoder().encode('hello'))
							},
						}),
					),
				),
			)

			try {
				const response = await fetch('/delayed-body')

				expect(events).toHaveLength(1)
				expect(events[0].state).toBe(ResourceState.DISCOVERED)

				bodyController?.close()
				await expect(response.text()).resolves.toBe('hello')
				await vi.waitFor(() => expect(events).toHaveLength(2))

				expect(events[1].state).toBe(ResourceState.LOADED)
				expect(events[0].id).toBe(events[1].id)
			} finally {
				restoreFetch()
			}
		})

		it('completes immediately when the response has no body', async () => {
			replaceMonitor({ waitForFetchResponseBody: true })
			const restoreFetch = replaceFetch(() => Promise.resolve(new Response(null, { status: 204 })))

			try {
				await fetch('/no-body')
				await vi.waitFor(() => expect(events).toHaveLength(2))

				expect(events[1].state).toBe(ResourceState.LOADED)
			} finally {
				restoreFetch()
			}
		})

		it('completes server-sent event responses without waiting for the body', async () => {
			replaceMonitor({ waitForFetchResponseBody: true })
			const response = new Response(new ReadableStream(), {
				headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
			})
			const restoreFetch = replaceFetch(() => Promise.resolve(response))

			try {
				await fetch('/events')
				await vi.waitFor(() => expect(events).toHaveLength(2))

				expect(events[1].state).toBe(ResourceState.LOADED)
			} finally {
				await response.body?.cancel()
				restoreFetch()
			}
		})

		it('releases the resource when reading the cloned body fails', async () => {
			replaceMonitor({ waitForFetchResponseBody: true })
			let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined
			const restoreFetch = replaceFetch(() =>
				Promise.resolve(
					new Response(
						new ReadableStream<Uint8Array>({
							start(controller) {
								bodyController = controller
							},
						}),
					),
				),
			)

			try {
				await fetch('/failed-body')
				bodyController?.error(new Error('body failed'))
				await vi.waitFor(() => expect(events).toHaveLength(2))

				expect(events[1].state).toBe(ResourceState.ERROR)
				expect(events[0].id).toBe(events[1].id)
			} finally {
				restoreFetch()
			}
		})

		it('releases the resource when fetch rejects', async () => {
			const restoreFetch = replaceFetch(() => Promise.reject(new Error('fetch failed')))

			try {
				await expect(fetch('/failed-fetch')).rejects.toThrow('fetch failed')

				expect(events).toHaveLength(2)
				expect(events[1].state).toBe(ResourceState.ERROR)
				expect(events[0].id).toBe(events[1].id)
			} finally {
				restoreFetch()
			}
		})
	})

	describe('XHR', () => {
		it('tracks XHR requests', async () => {
			await new Promise<void>((resolve) => {
				const xhr = new XMLHttpRequest()
				xhr.open('GET', `${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=xhr-track`)
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
			expect(events[0].id).toBe(events[1].id)
		})

		it('emits URLs matching ignore patterns because NavigationMetricsManager applies ignoreUrls', async () => {
			await new Promise<void>((resolve) => {
				const xhr = new XMLHttpRequest()
				xhr.open('GET', `${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=ignore-me-test`)
				xhr.addEventListener('load', () => resolve())
				xhr.addEventListener('error', () => resolve())
				xhr.send()
			})

			// Allow microtasks to complete so monitor's event handlers are processed
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})
	})

	describe('start/stop', () => {
		it('stops tracking after stop()', async () => {
			monitor.stop()

			await fetch(`${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=after-stop`)

			expect(events.length).toBe(0)
		})

		it('restarts monitoring', async () => {
			monitor.stop()
			monitor.start()

			await fetch(`${HTTP_TEST_SERVER_URL}/delay?delay=0&resource=after-restart`)

			expect(events.length).toBe(2)
			expect(events[0].state).toBe(ResourceState.DISCOVERED)
			expect(events[1].state).toBe(ResourceState.LOADED)
			expect(events[0].id).toBe(events[1].id)
		})
	})

	function replaceMonitor(config: { waitForFetchResponseBody?: boolean }): void {
		monitor.stop()
		monitor = new FetchXhrMonitor({
			...config,
			onResourceStateChange: (event) => events.push(event),
		})
		monitor.start()
	}

	function replaceFetch(replacement: typeof window.fetch): () => void {
		monitor.stop()
		const originalFetch = window.fetch
		window.fetch = replacement
		monitor.start()

		return () => {
			monitor.stop()
			window.fetch = originalFetch
			monitor.start()
		}
	}
})
