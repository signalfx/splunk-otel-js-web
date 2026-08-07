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

import { type Span } from '@opentelemetry/api'

import { BROWSER_NAVIGATION_PAGE_SPAN_ID_ATTRIBUTE, BROWSER_NAVIGATION_PCT_RELEVANT_ATTRIBUTE } from './constants'
import { type NavigationActivity, type NavigationMetricsManager } from './navigation-metrics-manager'

export function setBrowserNavigationPageAttributes(
	span: Span,
	navigationMetricsManager: NavigationMetricsManager | undefined,
	startTime: number,
	activity?: NavigationActivity,
): void {
	const navigation = navigationMetricsManager?.getNavigationPageAttributes(startTime, activity)
	if (navigation) {
		span.setAttribute(BROWSER_NAVIGATION_PAGE_SPAN_ID_ATTRIBUTE, navigation.pageSpanId)
		span.setAttribute(BROWSER_NAVIGATION_PCT_RELEVANT_ATTRIBUTE, navigation.pctRelevant)
	}
}
