/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { SessionId, SessionData, UpdateSessionData } from '../../types'

export class Session {
	readonly id: SessionId

	private expiresAt?: number

	private readonly startTime: number

	constructor({ id, startTime, expiresAt }: SessionData) {
		this.id = id
		this.startTime = startTime
		this.expiresAt = expiresAt
	}

	getSessionData = (): SessionData => ({
		id: this.id,
		startTime: this.startTime,
		expiresAt: this.expiresAt,
	})

	updateSession = (data: UpdateSessionData) => {
		this.expiresAt = data.expiresAt
	}
}
