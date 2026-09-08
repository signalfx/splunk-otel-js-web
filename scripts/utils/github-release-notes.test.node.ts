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

import { appendCdnReleaseNotes, getChangelogReleaseNotes } from './github-release-notes.mjs'

describe('getChangelogReleaseNotes', () => {
	const changelog = `# Changelog

## 3.1.0

Release notes for 3.1.0.

### Fixes

- Fixed issue.

## 3.0.0

Release notes for 3.0.0.
`

	it('extracts the matching version section without the heading', () => {
		expect(getChangelogReleaseNotes(changelog, 'v3.1.0')).toBe(
			['Release notes for 3.1.0.', '', '### Fixes', '', '- Fixed issue.'].join('\n'),
		)
	})

	it('accepts versions without a leading v', () => {
		expect(getChangelogReleaseNotes(changelog, '3.0.0')).toBe('Release notes for 3.0.0.')
	})

	it('rejects missing versions', () => {
		expect(() => getChangelogReleaseNotes(changelog, 'v4.0.0')).toThrow('Could not find CHANGELOG section')
	})

	it('rejects empty sections', () => {
		expect(() => getChangelogReleaseNotes('# Changelog\n\n## 3.1.0\n\n## 3.0.0', 'v3.1.0')).toThrow(
			'CHANGELOG section for 3.1.0 is empty.',
		)
	})
})

describe('appendCdnReleaseNotes', () => {
	it('does not render a null release body as text', () => {
		expect(appendCdnReleaseNotes(null, '\n## CDN\n\ncdn links')).toBe('## CDN\n\ncdn links')
	})

	it('appends CDN notes after the existing release body', () => {
		expect(appendCdnReleaseNotes('Release body.\n', '\n## CDN\n\ncdn links')).toBe(
			'Release body.\n## CDN\n\ncdn links',
		)
	})
})
