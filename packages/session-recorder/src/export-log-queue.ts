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
import { log } from './log'
import { JsonObject } from 'type-fest'
import { SessionReplay, Stats } from './session-replay'

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
	queuedLogs.push(logItem)
	return setQueuedLogs(queuedLogs)
}

const setQueuedLogs = (queuedLogs: QueuedLog[]): boolean => {
	if (queuedLogs.length === 0) {
		removeQueuedLogs()
		return true
	}

	return safelySetLocalStorage(QUEUED_LOGS_STORAGE_KEY, JSON.stringify(queuedLogs))
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

export const removeAssetsFromQueuedLog = (
	queuedLog: QueuedLog,
	omit: { css: boolean; fonts: boolean; images: boolean },
): { log: QueuedLog; stats: Stats | null } => {
	const clonedLog = JSON.parse(JSON.stringify(queuedLog)) as QueuedLog
	let stats: Stats | null = null
	for (const log_ of clonedLog.data.resourceLogs) {
		const scopeLogs = log_.scopeLogs || []
		for (const scopeLog of scopeLogs) {
			for (const logRecord of scopeLog.logRecords) {
				log.debug('Processing log record', omit, logRecord)
				const metadata = logRecord.attributes.find((a) => a.key === 'segmentMetadata')
				if (!metadata) {
					continue
				}

				try {
					const segment = SessionReplay.loadPlainSegment({
						...JSON.parse(logRecord.body.stringValue),
						metadata: JSON.parse(metadata.value.stringValue),
					})
					const { metadata: convertedMetadata, ...plainSegment } = segment.toPlain({
						omit,
					})

					logRecord.body.stringValue = JSON.stringify(plainSegment)
					metadata.value.stringValue = JSON.stringify(convertedMetadata)
					stats = segment.stats()
				} catch (error) {
					log.error('Error happened during segment conversion', error)
				}
			}
		}
	}

	return { log: clonedLog, stats }
}
