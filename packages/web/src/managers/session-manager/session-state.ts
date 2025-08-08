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

export type RecorderType = 'rrweb' | 'splunk'

export type SessionState = {
	rt?: RecorderType
	sessionId: string
	startTime: number
	state: 'active' | 'not-started' | 'expired'
}

export function isActiveSession(session: SessionState): session is SessionState {
	return session.state === 'active'
}

export function isNotStartedSession(session: SessionState): session is SessionState {
	return session.state === 'not-started'
}

export function isExpiredSession(session: SessionState): session is SessionState {
	return session.state === 'expired'
}
