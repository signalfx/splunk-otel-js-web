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
import { defineConfig, devices } from '@playwright/test'

const REPORTERS = []
if (process.env.CI) {
	REPORTERS.push(['blob'], ['list'])
} else {
	REPORTERS.push(['list'], ['html', { open: 'never' }])
}

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './src/tests',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: REPORTERS,
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		// baseURL: 'http://127.0.0.1:3000',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], headless: true },
		},

		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'], headless: true },
		},

		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'], headless: true },
		},

		{
			name: 'edge',
			use: {
				...devices['Desktop Edge'],
				channel: 'msedge',
				headless: true,
			},
		},

		{
			name: 'chrome',
			use: {
				...devices['Desktop Chrome'],
				channel: 'chrome',
				headless: true,
			},
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: 'npm run server',
		url: 'http://127.0.0.1:3000',
		reuseExistingServer: !process.env.CI,
	},
})
