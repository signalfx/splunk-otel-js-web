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
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

const requiredEnvironmentVariables = [
	'NEXT_PUBLIC_SPLUNK_REALM',
	'NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME',
	'NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_VERSION',
	'SPLUNK_ACCESS_TOKEN',
]
const missingEnvironmentVariables = requiredEnvironmentVariables.filter((name) => !process.env[name]?.trim())

if (missingEnvironmentVariables.length > 0) {
	console.error(
		`Cannot preview source map upload. Set ${missingEnvironmentVariables.join(', ')} in this example's .env file. ` +
			'Copy .env.example to .env and fill in the values first.',
	)
	process.exit(1)
}

const require = createRequire(import.meta.url)
const cliPath = require.resolve('@splunk/rum-cli')
const cliArguments = [
	cliPath,
	'sourcemaps',
	'upload',
	'--realm',
	process.env.NEXT_PUBLIC_SPLUNK_REALM,
	'--app-name',
	process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME,
	'--app-version',
	process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_VERSION,
	'--path',
	'.next/static',
	'--dry-run',
]

if (process.argv.includes('--debug')) {
	cliArguments.push('--debug')
}

const result = spawnSync(process.execPath, cliArguments, { stdio: 'inherit' })

if (result.error) {
	console.error(`Could not start splunk-rum: ${result.error.message}`)
	process.exit(1)
}

process.exit(result.status ?? 1)
