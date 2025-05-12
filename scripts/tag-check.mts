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

import { exec } from 'child_process'
import * as path from 'path'
import { readFileSync } from 'fs'

const appRoot = process.cwd()
const packageJsonPath = path.join(appRoot, 'package.json')

// Read and parse package.json to get the version
const packageJsonValue = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version: string = packageJsonValue.version

exec('git tag -l --contains HEAD', (err, stdout) => {
	if (err) {
		console.error('Could not acquire git tags for HEAD.')
		process.exitCode = 1
		return
	}

	const hasMatchingTag = stdout.split('\n').some((line) => line.trim() === `v${version}`)
	if (!hasMatchingTag) {
		console.error('We could not find any matching tags for the current version.')
		process.exitCode = 1
	}
})
