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
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	webpack: (config, options) => {
		if (options.dev) {
			// Do not instrument code in development
			return config
		}

		if (options.isServer) {
			// Do not instrument server code
			return config
		}

		const previousEntryFunction = config.entry

		config.entry = async () => {
			const newEntries = await previousEntryFunction()
			for (const [key, value] of Object.entries(newEntries)) {
				if (!['main-app', 'pages/_app'].includes(key)) {
					continue
				}

				if (!Array.isArray(value)) {
					continue
				}

				newEntries[key] = ['./instrumentation.client.ts', ...value]
			}

			return newEntries
		}

		return config
	},
}

export default nextConfig
