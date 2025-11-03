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

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		clearMocks: true,
		coverage: {
			exclude: ['**/node_modules'],
			provider: 'istanbul',
		},
		exclude: ['**/node_modules/**/*.test.ts', '**/node_modules/**/*.test.node.ts'],
		include: ['**/*.test.ts'],
		pool: 'forks',
		projects: [
			{
				extends: true,
				test: {
					browser: {
						api: {
							host: '127.0.0.1',
							port: 1234,
						},
						enabled: true,
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
						provider: playwright(),
					},
					globalSetup: ['./tests/global-setup.ts'],
					include: ['**/*.test.ts'],
					name: { color: 'blue', label: 'browser' },
					setupFiles: ['./tests/setup.ts'],
				},
			},
			{
				extends: true,
				root: path.resolve(__dirname),
				test: {
					environment: 'node',
					exclude: ['**/*.test.ts'],
					include: ['**/*.test.node.ts'],
					name: { color: 'green', label: 'node' },
				},
			},
		],
		reporters: ['default', 'html'],
		retry: 3,
		root: path.resolve(__dirname),
	},
})
