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
import { execSync } from 'node:child_process'
import * as fs from 'node:fs/promises'

import type { Version } from './versions.mjs'

export const getCommitHash = () => {
	try {
		const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
		if (!commitHash) {
			throw new Error('Command returned an empty commit hash.')
		}

		return commitHash
	} catch (error) {
		throw new Error('Could not determine a commit hash for the CDN snapshot release.', { cause: error })
	}
}

export const getPackageVersion = async () => {
	const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8')) as { version?: string }
	if (!packageJson.version) {
		throw new Error('The root package.json does not define a version.')
	}

	return packageJson.version
}

export const createCdnSnapshotVersion = ({
	commitHash,
	packageVersion,
}: {
	commitHash: string
	packageVersion: string
}): Version => {
	const versionPrefix = packageVersion.startsWith('v') ? packageVersion : `v${packageVersion}`

	return {
		includeInGithubRelease: false,
		isVersionImmutable: true,
		name: `${versionPrefix}-${commitHash}`,
	}
}

export const getCdnSnapshotVersion = async () =>
	createCdnSnapshotVersion({
		commitHash: getCommitHash(),
		packageVersion: await getPackageVersion(),
	})
