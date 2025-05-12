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
export const generateScriptSnippet = ({
	isVersionImmutable,
	filename,
	publicUrl,
	integrityValue,
}: {
	filename: string
	integrityValue: string
	isVersionImmutable: boolean
	publicUrl: string
}) => {
	const lines = []

	lines.push(`${filename}:`)
	if (!isVersionImmutable) {
		lines.push(`<script src="${publicUrl}" crossorigin="anonymous"></script>`)
	} else {
		lines.push(`<script src="${publicUrl}" integrity="${integrityValue}" crossorigin="anonymous"></script>`)
	}

	return lines.join('\n')
}
