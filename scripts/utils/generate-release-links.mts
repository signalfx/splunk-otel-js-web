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
export const generateCDNLinks = (versions: [string, boolean][], cdnLinksByVersion: Record<string, string[]>) => [
	'\n## CDN',
	...versions.map(([version, isAutoUpdating]) => {
		if (cdnLinksByVersion[version].length === 0) {
			return ''
		}

		const lines = []
		let footer = ''

		if (!isAutoUpdating || version === 'latest') {
			lines.push(`### Version ${version}`, '')
		} else {
			lines.push(`<details><summary>Version ${version}</summary>`, '')
			footer = '</details>\n'
		}

		if (isAutoUpdating) {
			lines.push(
				'**WARNING: Content behind this URL might be updated when we release a new version.**',
				'For this reason we do not provide `integrity` attribute.',
				'',
			)
		}

		lines.push('```html', ...cdnLinksByVersion[version], '```\n', footer)

		return lines.join('\n')
	}),
]
