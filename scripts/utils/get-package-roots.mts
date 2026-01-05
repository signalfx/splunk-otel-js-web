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
import { accessSync, readdirSync } from 'node:fs'
import path from 'node:path'

export const getPackageRoots = () => {
	const appRoot = process.cwd()
	const packagesDir = path.resolve(appRoot, 'packages')

	return readdirSync(packagesDir, { withFileTypes: true })
		.filter((dirent) => {
			if (!dirent.isDirectory()) {
				return false
			}

			try {
				accessSync(path.resolve(packagesDir, dirent.name, 'package.json'))
				return true
			} catch {
				return false
			}
		})
		.map((dirent) => path.resolve(packagesDir, dirent.name))
}
