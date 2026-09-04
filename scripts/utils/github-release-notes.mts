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

const VERSION_HEADING_PREFIX = '## '

export const getChangelogReleaseNotes = (changelog: string, version: string) => {
	const normalizedVersion = version.startsWith('v') ? version.slice(1) : version
	const lines = changelog.split(/\r?\n/)
	const startIndex = lines.findIndex((line) => line.trim() === `${VERSION_HEADING_PREFIX}${normalizedVersion}`)

	if (startIndex === -1) {
		throw new Error(`Could not find CHANGELOG section for ${normalizedVersion}.`)
	}

	const endIndex = lines.findIndex((line, index) => index > startIndex && line.startsWith(VERSION_HEADING_PREFIX))
	const releaseNotes = lines
		.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex)
		.join('\n')
		.trim()

	if (releaseNotes.length === 0) {
		throw new Error(`CHANGELOG section for ${normalizedVersion} is empty.`)
	}

	return releaseNotes
}

export const appendCdnReleaseNotes = (releaseBody: null | string, cdnReleaseNotes: string) => {
	const body = releaseBody?.trimEnd() ?? ''
	const notes = cdnReleaseNotes.trim()

	if (body.length === 0) {
		return notes
	}

	return `${body}\n${notes}`
}
