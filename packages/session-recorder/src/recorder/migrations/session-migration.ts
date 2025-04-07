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
import { safelyGetLocalStorage, safelySetLocalStorage } from '../../storage'
import { RecorderType } from '../types'
import { isObject, isString } from '../../type-guards'

const RECORDER_METADATA_KEY = '_splunk_session_recorder_metadata'

interface RecorderMetadata {
	recorderType: RecorderType
	sessionId: string
}

export const getRecorderMetadata = (): RecorderMetadata | null => {
	const storedData = safelyGetLocalStorage(RECORDER_METADATA_KEY)
	if (!storedData) {
		return null
	}

	try {
		const parsedData = JSON.parse(storedData)
		if (isRecorderMetadata(parsedData)) {
			return parsedData
		} else {
			console.warn('Invalid recorder metadata found in local storage', parsedData)
			return null
		}
	} catch (error) {
		console.warn('Malformed recorder metadata found in local storage', error)
		return null
	}
}

export const setRecorderMetadata = (metadata: RecorderMetadata) => {
	safelySetLocalStorage(RECORDER_METADATA_KEY, JSON.stringify(metadata))
}

const isRecorderMetadata = (maybeMetadata: unknown): maybeMetadata is RecorderMetadata => {
	if (!maybeMetadata || !isObject(maybeMetadata)) {
		return false
	}

	const allowedRecorderTypes: RecorderType[] = ['rrweb', 'splunk']

	return (
		'sessionId' in maybeMetadata &&
		isString(maybeMetadata.sessionId) &&
		'recorderType' in maybeMetadata &&
		isString(maybeMetadata.recorderType) &&
		allowedRecorderTypes.includes(maybeMetadata.recorderType as RecorderType)
	)
}
