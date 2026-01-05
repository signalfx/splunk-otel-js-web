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

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addLogToQueue, getQueuedLogs, QueuedLog } from './export-log-queue'
import * as storage from './storage'

vi.mock('./storage', () => ({
	safelyGetLocalStorage: vi.fn(),
	safelyRemoveFromLocalStorage: vi.fn(),
	safelySetLocalStorage: vi.fn(),
}))

vi.mock('./session-replay', () => ({
	SessionReplay: {
		loadPlainSegment: vi.fn(),
	},
	Stats: vi.fn(),
}))

const createMockQueuedLog = (size: number): QueuedLog => {
	const largeString = 'x'.repeat(Math.max(0, size - 200)) // Account for other fields
	return {
		data: {
			resourceLogs: [
				{
					scopeLogs: [
						{
							logRecords: [
								{
									attributes: [],
									body: {
										stringValue: largeString,
									},
								},
							],
						},
					],
				},
			],
			spanLogs: [],
		},
		headers: {},
		requestId: 'test-request-id',
		sessionId: 'test-session-id',
		timestamp: Date.now(),
		url: 'https://example.com',
	}
}

describe('Export Log Queue Size Limits', () => {
	const mockSafelyGetLocalStorage = vi.mocked(storage.safelyGetLocalStorage)
	const mockSafelySetLocalStorage = vi.mocked(storage.safelySetLocalStorage)

	beforeEach(() => {
		vi.clearAllMocks()
		mockSafelyGetLocalStorage.mockReturnValue(null)
		mockSafelySetLocalStorage.mockReturnValue(true)
	})

	describe('Queue Size Limit Enforcement', () => {
		it('should prevent adding logs when 2MB limit would be exceeded', () => {
			// Create logs that exceed 2MB when combined
			const largeLog1 = createMockQueuedLog(1.5 * 1024 * 1024) // 1.5MB
			const largeLog2 = createMockQueuedLog(1.5 * 1024 * 1024) // 1.5MB

			// Mock existing logs in storage
			mockSafelyGetLocalStorage.mockReturnValue(JSON.stringify([largeLog1]))

			// Try to add the second large log
			const result = addLogToQueue(largeLog2)

			// Should fail to prevent exceeding limit
			expect(result).toBe(false)
			// Should not call setLocalStorage since the operation failed
			expect(mockSafelySetLocalStorage).not.toHaveBeenCalled()
		})

		it('should prevent adding single log larger than 2MB', () => {
			// Create a log larger than 2MB
			const hugeLog = createMockQueuedLog(3 * 1024 * 1024) // 3MB

			const result = addLogToQueue(hugeLog)

			// Should fail to prevent exceeding limit
			expect(result).toBe(false)
			// Should not modify storage
			expect(mockSafelySetLocalStorage).not.toHaveBeenCalled()
		})

		it('should allow adding logs when under the limit', () => {
			// Create logs that are well under 2MB when combined
			const smallLog1 = createMockQueuedLog(500 * 1024) // 500KB
			const smallLog2 = createMockQueuedLog(500 * 1024) // 500KB

			// Mock existing logs in storage
			mockSafelyGetLocalStorage.mockReturnValue(JSON.stringify([smallLog1]))

			// Add the second small log
			const result = addLogToQueue(smallLog2)

			// Should succeed
			expect(result).toBe(true)
			expect(mockSafelySetLocalStorage).toHaveBeenCalled()
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty queue gracefully', () => {
			mockSafelyGetLocalStorage.mockReturnValue(null)

			const result = addLogToQueue(createMockQueuedLog(1000))
			expect(result).toBe(true)
		})

		it('should handle malformed data in storage', () => {
			mockSafelyGetLocalStorage.mockReturnValue('invalid-json')

			const logs = getQueuedLogs()
			expect(logs).toBe(null)
		})
	})
})
