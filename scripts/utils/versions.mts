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
import { getCdnSnapshotVersion } from './cdn-snapshot-version.mjs'

export interface Version {
	includeInGithubRelease: boolean
	isVersionImmutable: boolean
	name: string
}

async function* generateAllVersions(version: string): AsyncGenerator<Version, void, unknown> {
	if (version === 'main') {
		yield await getCdnSnapshotVersion()
		yield { includeInGithubRelease: false, isVersionImmutable: false, name: 'next' }
		return
	}

	const versionParts = version.split('.')

	let isVersionImmutable = true
	while (versionParts.length > 0) {
		yield { includeInGithubRelease: true, isVersionImmutable, name: `${versionParts.join('.')}` }
		const lastSegment = versionParts.pop()

		if (lastSegment === undefined) {
			throw new TypeError('lastSegment is undefined')
		}

		if (lastSegment.search(/[\D-]/) > -1 && versionParts.length > 0) {
			// Pre-release version
			break
		}

		isVersionImmutable = false
	}
}

export const getAllVersions = async (version: string) => {
	const versions: Version[] = []
	for await (const generatedVersion of generateAllVersions(version)) {
		versions.push(generatedVersion)
	}

	return versions
}
