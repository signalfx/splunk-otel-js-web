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
import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = dirname(fileURLToPath(import.meta.url))

function findWebpackConfigs(dir, result = []) {
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry)
		if (statSync(fullPath).isDirectory()) {
			findWebpackConfigs(fullPath, result)
		} else if (/^webpack\.config\./.test(entry)) {
			result.push(fullPath)
		}
	}
	return result
}

const configs = findWebpackConfigs(`${currentDirectory}/project`)

if (configs.length === 0) {
	console.log('No webpack config files found.')
	process.exit(0)
}

for (const configPath of configs) {
	const configFile = basename(configPath)
	console.log(`Running webpack for ${configPath}`)
	execSync(`webpack --config ${configFile}`, {
		cwd: `${currentDirectory}/project`,
		stdio: 'inherit',
	})
}
