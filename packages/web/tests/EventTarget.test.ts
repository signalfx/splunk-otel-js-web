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
import { InternalEventTarget } from '../src/EventTarget'

import { describe, it, expect, vi } from 'vitest'

describe('InternalEventTarget', () => {
	it('should be able to create a new InternalEventTarget', () => {
		const target = new InternalEventTarget()

		expect(target).toBeInstanceOf(InternalEventTarget)
	})

	it('should allow adding and emitting events', () => {
		const target = new InternalEventTarget()
		const listener = vi.fn()

		target.addEventListener('global-attributes-changed', listener)
		target.emit('global-attributes-changed', { attributes: { key: 'value' } })

		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener).toHaveBeenCalledWith({ payload: { attributes: { key: 'value' } } })
	})

	it('should allow removing event listeners', () => {
		const target = new InternalEventTarget()
		const listener = vi.fn()

		target.addEventListener('session-changed', listener)
		target.removeEventListener('session-changed', listener)
		target.emit('session-changed', { sessionId: '12345' })

		expect(listener).not.toHaveBeenCalled()
	})

	it('should handle "once" option for event listeners', () => {
		const target = new InternalEventTarget()
		const listener = vi.fn()

		target.addEventListener('global-attributes-changed', listener, { once: true })
		target.emit('global-attributes-changed', { attributes: { key: 'value' } })
		target.emit('global-attributes-changed', { attributes: { key: 'value2' } })

		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener).toHaveBeenCalledWith({ payload: { attributes: { key: 'value' } } })
	})

	it('should not fail when emitting an event with no listeners', () => {
		const target = new InternalEventTarget()

		expect(() => {
			target.emit('session-changed', { sessionId: '12345' })
		}).not.toThrow()
	})

	it('should not fail when removing a non-existent listener', () => {
		const target = new InternalEventTarget()
		const listener = vi.fn()

		expect(() => {
			target.removeEventListener('global-attributes-changed', listener)
		}).not.toThrow()
	})

	it('should log an error to the console when listener throws an error and emit does not throw', () => {
		const target = new InternalEventTarget()
		const listener = vi.fn(() => {
			throw new Error('Listener error')
		})
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

		target.addEventListener('global-attributes-changed', listener)

		expect(() => {
			target.emit('global-attributes-changed', { attributes: { key: 'value' } })
		}).not.toThrow()

		expect(listener).toHaveBeenCalledTimes(1)
		expect(consoleErrorSpy).toHaveBeenCalledWith('Error in event listener', expect.any(Error))
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Error in event listener',
			expect.objectContaining({ message: 'Listener error' }),
		)

		consoleErrorSpy.mockRestore()
	})
})
