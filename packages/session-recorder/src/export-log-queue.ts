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
import { JsonObject } from 'type-fest'

import { log } from './log'
import { safelyGetLocalStorage, safelyRemoveFromLocalStorage, safelySetLocalStorage } from './storage'

export interface QueuedLog {
	data: {
		resourceLogs: {
			scopeLogs: {
				logRecords: {
					attributes: {
						key: string
						value: {
							stringValue: string
						}
					}[]
					body: {
						stringValue: string
					}
				}[]
			}[]
		}[]
		spanLogs: JsonObject[]
	}
	headers: Record<string, string>
	requestId: string
	sessionId: string
	timestamp: number
	url: string
}

const QUEUED_LOGS_STORAGE_KEY = '_splunk_session_recorder_queue_data'
const MAX_QUEUE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB limit

export const getQueuedLogs = (): QueuedLog[] | null => {
	const storedLogs = safelyGetLocalStorage(QUEUED_LOGS_STORAGE_KEY)
	if (!storedLogs) {
		return null
	}

	try {
		const parsedQueuedLogs = JSON.parse(storedLogs)
		if (isQueuedLogs(parsedQueuedLogs)) {
			return parsedQueuedLogs
		} else {
			log.warn('Invalid queued log data found in local storage', parsedQueuedLogs)
			return null
		}
	} catch {
		log.warn('Malformed queued log data found in local storage', storedLogs)
		return null
	}
}

export const addLogToQueue = (logItem: QueuedLog): boolean => {
	const queuedLogs = getQueuedLogs() ?? []

	if (wouldExceedSizeLimit(queuedLogs, logItem)) {
		const currentSize = calculateQueueSize(queuedLogs)
		const newLogSize = calculateQueueSize([logItem])
		const currentSizeKB = Math.round(currentSize / 1024)
		const newLogSizeKB = Math.round(newLogSize / 1024)
		const limitKB = Math.round(MAX_QUEUE_SIZE_BYTES / 1024)
		log.warn(
			`Cannot add log to queue - would exceed 2MB limit. Current queue: ${currentSizeKB}KB, New log: ${newLogSizeKB}KB, Limit: ${limitKB}KB`,
		)
		return false
	}

	queuedLogs.push(logItem)
	return setQueuedLogs(queuedLogs)
}

const calculateQueueSize = (queuedLogs: QueuedLog[]): number => {
	const serialized = JSON.stringify(queuedLogs)
	return new TextEncoder().encode(serialized).length
}

const wouldExceedSizeLimit = (existingLogs: QueuedLog[], newLog: QueuedLog): boolean => {
	const combinedLogs = [...existingLogs, newLog]
	const combinedSize = calculateQueueSize(combinedLogs)
	return combinedSize > MAX_QUEUE_SIZE_BYTES
}

const setQueuedLogs = (queuedLogs: QueuedLog[]): boolean => {
	if (queuedLogs.length === 0) {
		removeQueuedLogs()
		return true
	}

	const serializedLogs = JSON.stringify(queuedLogs)
	return safelySetLocalStorage(QUEUED_LOGS_STORAGE_KEY, serializedLogs)
}

export const removeQueuedLog = (logToRemove: QueuedLog): boolean => {
	const queuedLogs = getQueuedLogs() ?? []
	const updatedLogs = queuedLogs.filter((logItem) => logItem.requestId !== logToRemove.requestId)
	return setQueuedLogs(updatedLogs)
}

export const removeQueuedLogs = () => {
	safelyRemoveFromLocalStorage(QUEUED_LOGS_STORAGE_KEY)
}

const isQueuedLog = (maybeQueuedLog: unknown): maybeQueuedLog is QueuedLog => {
	if (typeof maybeQueuedLog !== 'object' || maybeQueuedLog === null) {
		return false
	}

	const queuedLogKeys = Object.keys(maybeQueuedLog)
	const requiredKeys: (keyof QueuedLog)[] = ['data', 'requestId', 'timestamp', 'url', 'headers']
	return requiredKeys.every((key) => queuedLogKeys.includes(key))
}

const isQueuedLogs = (maybeQueuedLogs: unknown): maybeQueuedLogs is QueuedLog[] => {
	if (!Array.isArray(maybeQueuedLogs)) {
		return false
	}

	return maybeQueuedLogs.every(isQueuedLog)
}
