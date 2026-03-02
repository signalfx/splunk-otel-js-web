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

export type ExternalSessionMetadata = {
	anonymousUserId?: string
	sessionId: string
	sessionLastActivity: number
	sessionStart: number
} | null

export function isValidExternalSessionMetadata(value: unknown): value is NonNullable<ExternalSessionMetadata> {
	if (typeof value !== 'object' || value === null) {
		return false
	}

	const metadata = value as Record<string, unknown>

	return (
		typeof metadata.sessionId === 'string' &&
		metadata.sessionId.length > 0 &&
		typeof metadata.sessionStart === 'number' &&
		Number.isFinite(metadata.sessionStart) &&
		metadata.sessionStart > 0 &&
		typeof metadata.sessionLastActivity === 'number' &&
		Number.isFinite(metadata.sessionLastActivity) &&
		metadata.sessionLastActivity > 0 &&
		typeof metadata.anonymousUserId === 'string' &&
		metadata.anonymousUserId.length > 0
	)
}
