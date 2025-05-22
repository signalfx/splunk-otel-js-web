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
export interface Version {
	isVersionImmutable: boolean
	name: string
}

function* generateAllVersions(version: string): Generator<Version, void, unknown> {
	if (version === 'main') {
		yield { name: 'next', isVersionImmutable: false }
		return
	}

	const versionParts = version.split('.')

	let isVersionImmutable = true
	let isPreRelease = false
	while (versionParts.length) {
		yield { name: `${versionParts.join('.')}`, isVersionImmutable }
		const lastSegment = versionParts.pop()

		if (lastSegment === undefined) {
			throw TypeError('lastSegment is undefined')
		}

		if (lastSegment.search(/[\D-]/) > -1 && versionParts.length > 0) {
			// Pre-release version
			isPreRelease = true
			break
		}

		isVersionImmutable = false
	}

	if (!isPreRelease) {
		yield { name: 'latest', isVersionImmutable: false }
	}
}

export const getAllVersions = (version: string) => Array.from(generateAllVersions(version))
