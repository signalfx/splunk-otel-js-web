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
import { describe, expect, it } from 'vitest'

import { createCdnSnapshotVersion } from './cdn-snapshot-version.mjs'
import { getAllVersions } from './versions.mjs'

describe('getAllVersions', () => {
	it('returns exact, minor, and major aliases for stable versions', async () => {
		expect(await getAllVersions('v3.0.0')).toEqual([
			{ includeInGithubRelease: true, isVersionImmutable: true, name: 'v3.0.0' },
			{ includeInGithubRelease: true, isVersionImmutable: false, name: 'v3.0' },
			{ includeInGithubRelease: true, isVersionImmutable: false, name: 'v3' },
		])
	})

	it('returns the upload-only commit hash version before next for main', async () => {
		expect(await getAllVersions('main')).toEqual([
			{
				includeInGithubRelease: false,
				isVersionImmutable: true,
				name: expect.stringMatching(/^v[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]+$/),
			},
			{ includeInGithubRelease: false, isVersionImmutable: false, name: 'next' },
		])
	})

	it('creates an upload-only commit hash version', () => {
		expect(createCdnSnapshotVersion({ commitHash: 'abc123', packageVersion: '3.0.0' })).toEqual({
			includeInGithubRelease: false,
			isVersionImmutable: true,
			name: 'v3.0.0-abc123',
		})
	})

	it('does not add the upload-only commit hash version before stable release aliases', async () => {
		const versions = await getAllVersions('v3.0.0')

		expect(versions).toEqual([
			{ includeInGithubRelease: true, isVersionImmutable: true, name: 'v3.0.0' },
			{ includeInGithubRelease: true, isVersionImmutable: false, name: 'v3.0' },
			{ includeInGithubRelease: true, isVersionImmutable: false, name: 'v3' },
		])
	})
})
