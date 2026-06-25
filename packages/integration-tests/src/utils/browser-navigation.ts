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
import { expect } from '@playwright/test'
import type { ExportedTestSpan } from '@test-utils/test-span.js'

export const BROWSER_NAVIGATION_ATTRIBUTES = {
	detectedResourceCount: 'browser.navigation.detected_resource_count',
	lastLoadedResources: 'browser.navigation.last_loaded_resources',
	loadingResourceCount: 'browser.navigation.loading_resource_count',
	loadingResourceUrls: 'browser.navigation.loading_resource_urls',
	longestLoadedResource: 'browser.navigation.longest_loaded_resource',
	pageCompletionTime: 'browser.navigation.page_completion_time',
	quietTimerResetCount: 'browser.navigation.quiet_timer_reset_count',
	status: 'browser.navigation.status',
} as const

type BrowserNavigationAttributeExpectations = {
	detectedResourceCount?: number
	pageCompletionTime?: number
	quietTimerResetCount?: number
	status?: 'completed' | 'interrupted' | 'timeout'
}

export function expectBrowserNavigationAttributes(
	span: ExportedTestSpan,
	{ detectedResourceCount, pageCompletionTime, quietTimerResetCount, status }: BrowserNavigationAttributeExpectations,
): void {
	expect(span).toHaveNumericAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageCompletionTime)
	expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.status)
	expect(span).toHaveNumericAttribute(BROWSER_NAVIGATION_ATTRIBUTES.detectedResourceCount)
	expect(span).toHaveNumericAttribute(BROWSER_NAVIGATION_ATTRIBUTES.quietTimerResetCount)

	if (status !== undefined) {
		expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.status, status)
	}

	if (pageCompletionTime !== undefined) {
		expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.pageCompletionTime, pageCompletionTime)
	}

	if (detectedResourceCount !== undefined) {
		expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.detectedResourceCount, detectedResourceCount)
	}

	if (quietTimerResetCount !== undefined) {
		expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_ATTRIBUTES.quietTimerResetCount, quietTimerResetCount)
	}
}
