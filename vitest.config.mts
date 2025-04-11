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
import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		browser: {
			enabled: true,
			provider: 'playwright',
			headless: true,
			instances: [
				{
					browser: 'chromium',
				},
				{
					browser: 'firefox',
				},
				{
					browser: 'webkit',
				},
			],
			api: {
				host: '127.0.0.1',
				port: 1234,
			},
		},
		retry: 3,
		clearMocks: true,
		coverage: {
			exclude: ['**/node_modules'],
			provider: 'istanbul',
		},
		include: ['**/*.test.ts'],
		exclude: ['./node_modules/**/*.test.ts', './packages/build-plugins/**/*.test.ts'],
		pool: 'forks',
		root: path.resolve(__dirname),
		reporters: ['default', 'html'],
		globalSetup: ['./tests/global-setup.ts'],
		setupFiles: ['./tests/setup.ts'],
	},
})
