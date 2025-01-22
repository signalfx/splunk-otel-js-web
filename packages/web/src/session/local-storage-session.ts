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
import { SessionState } from './types'
import { safelyGetLocalStorage, safelySetLocalStorage, safelyRemoveFromLocalStorage } from '../utils/storage'
import { SESSION_STORAGE_KEY } from './constants'
import { isSessionDurationExceeded, isSessionInactivityTimeoutReached, isSessionState } from './utils'
import { throttle } from '../utils/throttle'

export const localStore = {
	cachedValue: undefined,
	set: (value: string) => {
		localStore.cachedValue = value
		localStore._set(value)
	},

	flush: () => {
		localStore._set.flush()
	},

	_set: throttle((value: string) => {
		safelySetLocalStorage(SESSION_STORAGE_KEY, value)
	}, 1000),

	get: ({ forceStoreRead }: { forceStoreRead: boolean }): string => {
		if (localStore.cachedValue === undefined || forceStoreRead) {
			localStore.cachedValue = safelyGetLocalStorage(SESSION_STORAGE_KEY)
			return localStore.cachedValue
		}

		return localStore.cachedValue
	},
	remove: () => {
		safelyRemoveFromLocalStorage(SESSION_STORAGE_KEY)
		localStore.cachedValue = undefined
	},
}

export const getSessionStateFromLocalStorage = ({
	forceStoreRead,
}: {
	forceStoreRead: boolean
}): SessionState | undefined => {
	let sessionState: unknown = undefined
	try {
		sessionState = JSON.parse(localStore.get({ forceStoreRead }))
	} catch {
		return undefined
	}

	if (!isSessionState(sessionState)) {
		return
	}

	if (isSessionDurationExceeded(sessionState) || isSessionInactivityTimeoutReached(sessionState)) {
		return
	}

	return sessionState
}

export const setSessionStateToLocalStorage = (
	sessionState: SessionState,
	{ forceStoreWrite }: { forceStoreWrite: boolean },
): void => {
	if (isSessionDurationExceeded(sessionState)) {
		return
	}

	localStore.set(JSON.stringify(sessionState))
	if (forceStoreWrite) {
		localStore.flush()
	}
}

export const clearSessionStateFromLocalStorage = (): void => {
	localStore.remove()
}
