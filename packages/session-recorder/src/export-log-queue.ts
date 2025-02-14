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
import { safelyGetLocalStorage, safelySetLocalStorage, safelyRemoveFromLocalStorage } from './storage'

export interface QueuedLog {
	data: Uint8Array
	headers: Record<string, string>
	requestId: string
	sessionId: string
	timestamp: number
	url: string
}

const QUEUED_LOGS_STORAGE_KEY = '_splunk_session_recorder_queue_data'

export const getQueuedLogs = (): QueuedLog[] | null => {
	const storedLogs = safelyGetLocalStorage(QUEUED_LOGS_STORAGE_KEY)
	if (!storedLogs) {
		return null
	}

	try {
		const parsedQueuedLogs = JSON.parse(storedLogs)
		if (isQueuedLogs(parsedQueuedLogs)) {
			return parsedQueuedLogs.map((log) => ({ ...log, data: new Uint8Array(log.data) }))
		} else {
			console.warn('Invalid queued log data found in local storage', parsedQueuedLogs)
			return null
		}
	} catch {
		console.warn('Malformed queued log data found in local storage', storedLogs)
		return null
	}
}

export const addLogToQueue = (log: QueuedLog): boolean => {
	const queuedLogs = getQueuedLogs() ?? []
	queuedLogs.push(log)
	setQueuedLogs(queuedLogs)
	return true
}

const setQueuedLogs = (queuedLogs: QueuedLog[]): void => {
	if (queuedLogs.length === 0) {
		removeQueuedLogs()
		return
	}

	safelySetLocalStorage(
		QUEUED_LOGS_STORAGE_KEY,
		JSON.stringify(queuedLogs.map((log) => ({ ...log, data: Array.from(log.data) }))),
	)
}

export const removeQueuedLog = (logToRemove: QueuedLog) => {
	const queuedLogs = getQueuedLogs() ?? []
	const updatedLogs = queuedLogs.filter((log) => log.requestId !== logToRemove.requestId)
	setQueuedLogs(updatedLogs)
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
