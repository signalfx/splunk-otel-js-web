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

export function parseVersion(version: string): {
	exactVersion: string
	majorVersion: string
	minorVersion: string
} {
	// Remove prerelease tags like -beta.0, -alpha.5, -rc.1, etc.
	const cleanVersion = version.split('-')[0]
	const versionParts = cleanVersion.split('.')

	return {
		exactVersion: `v${cleanVersion}`,
		majorVersion: `v${versionParts[0]}`,
		minorVersion: `v${versionParts[0]}.${versionParts[1]}`,
	}
}
