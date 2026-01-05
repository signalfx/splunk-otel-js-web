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

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { getPackageRoots } from './utils/index.mjs'

getPackageRoots().forEach((packagePath) => {
	const packageJsonPath = path.resolve(packagePath, 'package.json')
	const { name, version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

	const versionFilePath = path.resolve(packagePath, 'src', 'version.ts')
	const versionFileContent = readFileSync(versionFilePath, 'utf8')

	const hasMatchingInternalVersion = versionFileContent.includes(`export const VERSION = '${version}'`)
	if (!hasMatchingInternalVersion) {
		console.error(`The version in src/version.ts does not match the ${name} package version.`)
		process.exitCode = 1
	}
})
