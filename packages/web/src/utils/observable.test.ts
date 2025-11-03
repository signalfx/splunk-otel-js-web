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

import { diag } from '@opentelemetry/api'
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { Observable } from './observable'

describe('Observable', () => {
	let observable: Observable<string>
	let mockDiagError: Mock

	beforeEach(() => {
		observable = new Observable<string>()
		mockDiagError = vi.fn<(message: string, ...args: unknown[]) => void>()
		vi.spyOn(diag, 'error').mockImplementation(mockDiagError)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('constructor', () => {
		it('should create an empty observable', () => {
			const obs = new Observable<number>()
			expect(obs).toBeInstanceOf(Observable)
		})

		it('should initialize with no observers', () => {
			const obs = new Observable<string>()
			expect(obs['observers']).toEqual([])
		})
	})

	describe('subscribe', () => {
		it('should add observer to the list', () => {
			const observer = vi.fn()

			observable.subscribe(observer)

			expect(observable['observers']).toContain(observer)
		})

		it('should return unsubscribe function', () => {
			const observer = vi.fn()

			const unsubscribe = observable.subscribe(observer)

			expect(typeof unsubscribe).toBe('function')
		})

		it('should allow multiple observers', () => {
			const observer1 = vi.fn()
			const observer2 = vi.fn()
			const observer3 = vi.fn()

			observable.subscribe(observer1)
			observable.subscribe(observer2)
			observable.subscribe(observer3)

			expect(observable['observers']).toHaveLength(3)
			expect(observable['observers']).toContain(observer1)
			expect(observable['observers']).toContain(observer2)
			expect(observable['observers']).toContain(observer3)
		})

		it('should allow the same observer to be subscribed multiple times', () => {
			const observer = vi.fn()

			observable.subscribe(observer)
			observable.subscribe(observer)

			expect(observable['observers']).toHaveLength(2)
			expect(observable['observers'].filter((o) => o === observer)).toHaveLength(2)
		})
	})

	describe('unsubscribe', () => {
		it('should remove observer from the list', () => {
			const observer = vi.fn()

			const unsubscribe = observable.subscribe(observer)
			expect(observable['observers']).toContain(observer)

			unsubscribe()
			expect(observable['observers']).not.toContain(observer)
		})

		it('should only remove the specific observer instance', () => {
			const observer1 = vi.fn()
			const observer2 = vi.fn()

			const unsubscribe1 = observable.subscribe(observer1)
			observable.subscribe(observer2)

			unsubscribe1()

			expect(observable['observers']).not.toContain(observer1)
			expect(observable['observers']).toContain(observer2)
		})

		it('should handle unsubscribing the same observer multiple times', () => {
			const observer = vi.fn()

			const unsubscribe = observable.subscribe(observer)

			unsubscribe()
			expect(observable['observers']).not.toContain(observer)

			// Should not throw error when called again
			expect(() => unsubscribe()).not.toThrow()
			expect(observable['observers']).not.toContain(observer)
		})

		it('should handle unsubscribing when observer was subscribed multiple times', () => {
			const observer = vi.fn()

			const unsubscribe1 = observable.subscribe(observer)
			const unsubscribe2 = observable.subscribe(observer)

			expect(observable['observers'].filter((o) => o === observer)).toHaveLength(2)

			unsubscribe1()
			expect(observable['observers'].filter((o) => o === observer)).toHaveLength(1)

			unsubscribe2()
			expect(observable['observers'].filter((o) => o === observer)).toHaveLength(0)
		})

		it('should work correctly with multiple different observers', () => {
			const observer1 = vi.fn()
			const observer2 = vi.fn()
			const observer3 = vi.fn()

			observable.subscribe(observer1)
			const unsubscribe2 = observable.subscribe(observer2)
			observable.subscribe(observer3)

			unsubscribe2()

			expect(observable['observers']).toContain(observer1)
			expect(observable['observers']).not.toContain(observer2)
			expect(observable['observers']).toContain(observer3)
			expect(observable['observers']).toHaveLength(2)
		})
	})

	describe('notify', () => {
		it('should call all subscribed observers', () => {
			const observer1 = vi.fn()
			const observer2 = vi.fn()
			const observer3 = vi.fn()
			const testData = 'test-data'

			observable.subscribe(observer1)
			observable.subscribe(observer2)
			observable.subscribe(observer3)

			observable.notify(testData)

			expect(observer1).toHaveBeenCalledWith(testData)
			expect(observer2).toHaveBeenCalledWith(testData)
			expect(observer3).toHaveBeenCalledWith(testData)
			expect(observer1).toHaveBeenCalledTimes(1)
			expect(observer2).toHaveBeenCalledTimes(1)
			expect(observer3).toHaveBeenCalledTimes(1)
		})

		it('should work with no observers', () => {
			expect(() => observable.notify('test')).not.toThrow()
		})

		it('should call observers in subscription order', () => {
			const callOrder: number[] = []
			const observer1 = vi.fn(() => callOrder.push(1))
			const observer2 = vi.fn(() => callOrder.push(2))
			const observer3 = vi.fn(() => callOrder.push(3))

			observable.subscribe(observer1)
			observable.subscribe(observer2)
			observable.subscribe(observer3)

			observable.notify('test')

			expect(callOrder).toEqual([1, 2, 3])
		})

		it('should handle observer errors gracefully', () => {
			const workingObserver = vi.fn()
			const errorObserver = vi.fn(() => {
				throw new Error('Observer error')
			})
			const anotherWorkingObserver = vi.fn()

			observable.subscribe(workingObserver)
			observable.subscribe(errorObserver)
			observable.subscribe(anotherWorkingObserver)

			expect(() => observable.notify('test')).not.toThrow()

			expect(workingObserver).toHaveBeenCalledWith('test')
			expect(errorObserver).toHaveBeenCalledWith('test')
			expect(anotherWorkingObserver).toHaveBeenCalledWith('test')
			expect(mockDiagError).toHaveBeenCalledWith('Observable: Error happened in subscriber', expect.any(Error))
		})

		it('should handle multiple notifications', () => {
			const observer = vi.fn()

			observable.subscribe(observer)

			observable.notify('first')
			observable.notify('second')
			observable.notify('third')

			expect(observer).toHaveBeenCalledTimes(3)
			expect(observer).toHaveBeenNthCalledWith(1, 'first')
			expect(observer).toHaveBeenNthCalledWith(2, 'second')
			expect(observer).toHaveBeenNthCalledWith(3, 'third')
		})
	})
})
