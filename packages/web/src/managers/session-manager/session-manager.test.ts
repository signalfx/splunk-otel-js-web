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

import { diag } from '@opentelemetry/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StorageManager } from '../storage'
import { SESSION_ID_LENGTH, SESSION_INACTIVITY_TIMEOUT_MS } from './constants'
import { SessionManager } from './session-manager'

vi.mock('../../utils/is-trusted-event', () => ({
	isTrustedEvent: vi.fn(() => true),
}))

declare global {
	interface Window {
		SplunkRumNative?: {
			getNativeSessionId(): string
		}
	}
}

describe('SessionManager', () => {
	let sessionManager: SessionManager
	let storageManager: StorageManager

	beforeEach(() => {
		window.SplunkRumNative = undefined
		storageManager = new StorageManager({
			persistence: 'cookie',
		})
		storageManager.persistSessionState = vi.fn().mockReturnValue(true)
		storageManager.getSessionState = vi.fn().mockReturnValue(null)
		sessionManager = new SessionManager(storageManager)
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('Constructor', () => {
		it('should create a new active session when no persisted session exists', () => {
			storageManager = new StorageManager({
				persistence: 'cookie',
			})
			// eslint-disable-next-line unicorn/no-useless-undefined
			storageManager.getSessionState = vi.fn().mockReturnValue(undefined)
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)
			sessionManager = new SessionManager(storageManager)

			expect(sessionManager.getSessionId()).toHaveLength(SESSION_ID_LENGTH)
		})

		it('should use persisted session when valid session exists in storage', () => {
			const persistedSession = {
				expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
				id: 'persisted-session-id',
				startTime: Date.now(),
			}
			storageManager = new StorageManager({
				persistence: 'cookie',
			})
			storageManager.getSessionState = vi.fn().mockReturnValue(persistedSession)
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)

			sessionManager = new SessionManager(storageManager)

			expect(sessionManager.getSessionId()).toBe('persisted-session-id')
		})

		it('should create new session when persisted session is expired', () => {
			const expiredSession = {
				expiresAt: Date.now() - 1000,
				id: 'expired-session-id',
				startTime: Date.now() - SESSION_INACTIVITY_TIMEOUT_MS - 1000,
			}

			storageManager = new StorageManager({
				persistence: 'localStorage',
			})
			storageManager.getSessionState = vi.fn().mockReturnValue(expiredSession)
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)

			sessionManager = new SessionManager(storageManager)

			expect(sessionManager.getSessionId()).not.toBe('expired-session-id')
			expect(sessionManager.getSessionId()).toHaveLength(SESSION_ID_LENGTH)
		})

		it('should use native session when available', () => {
			window.SplunkRumNative = {
				getNativeSessionId: vi.fn().mockReturnValue('native-session-id'),
			}

			const persistedSession = {
				expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
				id: 'persisted-session-id',
				startTime: Date.now(),
			}

			storageManager = new StorageManager({
				persistence: 'localStorage',
			})
			storageManager.getSessionState = vi.fn().mockReturnValue(persistedSession)
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)

			sessionManager = new SessionManager(storageManager)

			expect(sessionManager.getSessionId()).toBe('native-session-id')
		})
	})

	describe('Static Methods', () => {
		describe('getNativeSessionId', () => {
			it('should return null when SplunkRumNative is not available', () => {
				window.SplunkRumNative = undefined

				expect(SessionManager.getNativeSessionId()).toBeNull()
			})

			it('should return native session ID when available', () => {
				window.SplunkRumNative = {
					getNativeSessionId: vi.fn().mockReturnValue('native-id'),
				}

				expect(SessionManager.getNativeSessionId()).toBe('native-id')
			})
		})

		describe('hasNativeSessionId', () => {
			it('should return false when SplunkRumNative is not available', () => {
				window.SplunkRumNative = undefined

				expect(SessionManager.hasNativeSessionId()).toBe(false)
			})

			it('should return true when SplunkRumNative is available', () => {
				window.SplunkRumNative = {
					getNativeSessionId: vi.fn(),
				}

				expect(SessionManager.hasNativeSessionId()).toBe(true)
			})
		})
	})

	describe('Start/Stop Lifecycle', () => {
		it('should start successfully and attach event listeners', () => {
			const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
			sessionManager.start()

			expect(addEventListenerSpy).toHaveBeenCalledTimes(4) // click, touchstart, keydown, scroll
			expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), {
				capture: true,
				passive: true,
			})
		})

		it('should warn when starting already started manager', () => {
			const diagWarnSpy = vi.spyOn(diag, 'warn')

			sessionManager.start()
			sessionManager.start()

			expect(diagWarnSpy).toHaveBeenCalledTimes(1)
			expect(diagWarnSpy).toHaveBeenCalledWith('SessionManager is already started.')
		})

		it('should stop successfully and remove event listeners', () => {
			const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

			sessionManager.start()
			sessionManager.stop()

			expect(removeEventListenerSpy).toHaveBeenCalledTimes(4)
		})

		it('should warn when stopping already stopped manager', () => {
			const diagWarnSpy = vi.spyOn(diag, 'warn')

			sessionManager.stop()

			expect(diagWarnSpy).toHaveBeenCalledTimes(1)
			expect(diagWarnSpy).toHaveBeenCalledWith('SessionManager is already stopped.')
		})
	})

	describe('Session State Changes and Notifications', () => {
		it('should notify subscribers of session state changes', () => {
			const mockSubscriber = vi.fn()
			sessionManager.subscribe(mockSubscriber)
			sessionManager.start()

			// First notification from start()
			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			mockSubscriber.mockClear()

			const keydownEvent = new KeyboardEvent('keydown', {
				bubbles: true,
				cancelable: true,
				code: 'Enter',
				key: 'Enter',
			})

			window.dispatchEvent(keydownEvent)

			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			expect(mockSubscriber).toHaveBeenLastCalledWith(
				expect.objectContaining({
					currentState: {
						expiresAt: expect.any(Number),
						id: expect.any(String),
						source: 'web',
						startTime: expect.any(Number),
						state: 'active',
					},
					previousState: null,
				}),
			)
		})

		it('should report isNew flag only once for a new session', () => {
			const mockSubscriber = vi.fn()

			// Create a new session manager (which creates a new session)
			storageManager = new StorageManager({
				persistence: 'cookie',
			})
			storageManager.getSessionState = vi.fn().mockReturnValue(null)
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)
			sessionManager = new SessionManager(storageManager)

			sessionManager.subscribe(mockSubscriber)
			sessionManager.start()

			// First notification should have isNew: true
			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			expect(mockSubscriber).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					currentState: expect.objectContaining({
						isNew: true,
						state: 'active',
					}),
					previousState: null,
				}),
			)

			mockSubscriber.mockClear()

			// Trigger another session state change by extending the session
			const keydownEvent = new KeyboardEvent('keydown', {
				bubbles: true,
				cancelable: true,
				code: 'Enter',
				key: 'Enter',
			})

			window.dispatchEvent(keydownEvent)

			// Second notification should NOT have isNew flag
			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			expect(mockSubscriber).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					currentState: expect.not.objectContaining({
						isNew: true,
					}),
				}),
			)
		})

		it('should report isNew flag when creating a new session after expiration', () => {
			vi.useFakeTimers()

			const mockSubscriber = vi.fn()
			const persistedSession = {
				expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
				id: 'initial-session-id',
				startTime: Date.now(),
			}

			storageManager = new StorageManager({
				persistence: 'cookie',
			})
			storageManager.getSessionState = vi.fn().mockReturnValue(persistedSession)
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)
			sessionManager = new SessionManager(storageManager)

			sessionManager.subscribe(mockSubscriber)
			sessionManager.start()

			// First notification for existing session should NOT have isNew flag
			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			expect(mockSubscriber).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					currentState: expect.not.objectContaining({
						isNew: true,
					}),
				}),
			)

			mockSubscriber.mockClear()

			// Expire the session
			vi.advanceTimersByTime(SESSION_INACTIVITY_TIMEOUT_MS + 1000)

			// watchSessionState interval will detect expiration and trigger a notification
			// This notification will mark the session as expired but NOT have isNew
			expect(mockSubscriber).toHaveBeenCalled()
			mockSubscriber.mockClear()

			// Mock storage to return null (no new session from another tab)
			storageManager.getSessionState = vi.fn().mockReturnValue(null)

			// Trigger user activity to create a new session
			const keydownEvent = new KeyboardEvent('keydown', {
				bubbles: true,
				cancelable: true,
				code: 'Enter',
				key: 'Enter',
			})

			window.dispatchEvent(keydownEvent)

			// Should notify with isNew: true for the new session
			expect(mockSubscriber).toHaveBeenCalled()
			const newSessionCall = mockSubscriber.mock.calls.find((call) => call[0].currentState.isNew === true)
			expect(newSessionCall).toBeDefined()
			expect(newSessionCall?.[0]).toMatchObject({
				currentState: expect.objectContaining({
					isNew: true,
					state: 'active',
				}),
			})

			// Verify the session ID changed
			expect(sessionManager.getSessionId()).not.toBe('initial-session-id')

			mockSubscriber.mockClear()

			// Advance time past throttle window (1 second)
			vi.advanceTimersByTime(1000)

			// Trigger another activity event - should NOT have isNew flag
			window.dispatchEvent(keydownEvent)

			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			expect(mockSubscriber).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					currentState: expect.not.objectContaining({
						isNew: true,
					}),
				}),
			)

			vi.useRealTimers()
		})

		it('should persist active session state to storage', () => {
			storageManager = new StorageManager({
				persistence: 'cookie',
			})
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)
			storageManager.getSessionState = vi.fn().mockReturnValue(null)
			sessionManager = new SessionManager(storageManager)
			sessionManager.start()

			expect(storageManager.persistSessionState).toHaveBeenCalledWith(
				expect.objectContaining({
					state: 'active',
				}),
			)
		})
	})

	describe('User Activity Handling', () => {
		beforeEach(() => {
			const persistedSession = {
				expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
				id: 'persisted-session-id',
				startTime: Date.now(),
			}
			storageManager = new StorageManager({
				persistence: 'cookie',
			})
			storageManager.getSessionState = vi.fn().mockReturnValue(persistedSession)
			storageManager.persistSessionState = vi.fn().mockReturnValue(true)
			sessionManager = new SessionManager(storageManager)
		})

		it('should create new session when current session is expired', () => {
			vi.useFakeTimers()

			sessionManager.start()

			// Advance time to expire the session
			vi.advanceTimersByTime(SESSION_INACTIVITY_TIMEOUT_MS + 1000)

			const keydownEvent = new KeyboardEvent('keydown', {
				bubbles: true,
				cancelable: true,
				code: 'Enter',
				key: 'Enter',
			})

			window.dispatchEvent(keydownEvent)

			expect(sessionManager.getSessionId()).not.toBe('persisted-session-id')
		})

		it('should not extend session when native session is available', () => {
			const diagDebugSpy = vi.spyOn(diag, 'debug')

			sessionManager.start()

			window.SplunkRumNative = {
				getNativeSessionId: vi.fn().mockReturnValue('native-id'),
			}

			const keydownEvent = new KeyboardEvent('keydown', {
				bubbles: true,
				cancelable: true,
				code: 'Enter',
				key: 'Enter',
			})

			window.dispatchEvent(keydownEvent)

			expect(diagDebugSpy).toHaveBeenCalledWith(
				'SessionManager: Native session ID detected. Session extension or creation is managed natively.',
			)
		})
	})

	describe('Storage Synchronization', () => {
		it('should sync with storage when another tab creates a new session', () => {
			vi.useFakeTimers()
			const mockSubscriber = vi.fn()

			const newSessionFromStorage = {
				expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
				id: 'session-from-another-tab',
				startTime: Date.now(),
			}

			sessionManager.subscribe(mockSubscriber)
			sessionManager.start()

			// First notification from start()
			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			mockSubscriber.mockClear()

			expect(sessionManager.getSessionId()).toHaveLength(32)

			storageManager.getSessionState = vi.fn().mockReturnValue(newSessionFromStorage)

			vi.advanceTimersByTime(1000)

			expect(sessionManager.getSessionId()).toBe('session-from-another-tab')
			expect(mockSubscriber).toHaveBeenCalledTimes(1)
			expect(mockSubscriber).toHaveBeenCalledWith(
				expect.objectContaining({
					currentState: {
						expiresAt: expect.any(Number),
						id: 'session-from-another-tab',
						source: 'web',
						startTime: expect.any(Number),
						state: 'active',
					},
					previousState: null,
				}),
			)
		})
	})

	describe('Cleanup', () => {
		it('should clear all intervals when stopped', () => {
			const clearIntervalSpy = vi.spyOn(window, 'clearInterval')

			sessionManager.start()
			sessionManager.stop()

			expect(clearIntervalSpy).toHaveBeenCalled()
		})

		it('should remove all event listeners when stopped', () => {
			const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

			sessionManager.start()
			sessionManager.stop()

			expect(removeEventListenerSpy).toHaveBeenCalledTimes(4)
			expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), {
				capture: true,
				passive: true,
			})
		})
	})
})
