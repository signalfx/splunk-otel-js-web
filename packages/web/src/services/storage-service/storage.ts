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
import { SessionData } from '../../types'

export abstract class Storage {
	abstract clear(): void

	abstract getSessionData(): SessionData | null

	abstract setSessionData(data: SessionData): void

	protected abstract get(key: string): string | null

	protected abstract remove(key: string): void

	protected abstract set(key: string, value: string): void
}
