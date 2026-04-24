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

/**
 * Detects whether a resource was loaded from cache using PerformanceResourceTiming.
 *
 * Uses two complementary heuristics from the Resource Timing API:
 * 1. responseStatus === 304 indicates a server-validated cache hit
 *    https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus#checking_if_a_cache_was_hit
 * 2. transferSize === 0 && decodedBodySize > 0 indicates a local/disk cache hit
 *    (transferSize 0 alone could mean cross-origin with no Timing-Allow-Origin)
 *    https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/transferSize#checking_if_a_cache_was_hit
 *
 * Returns undefined when cache status cannot be determined (e.g. cross-origin
 * without Timing-Allow-Origin, or when the required fields are unavailable).
 */
export function isCacheHit(entry: PerformanceResourceTiming): boolean | undefined {
	if (typeof entry.responseStatus === 'number' && entry.responseStatus === 304) {
		return true
	}

	if (typeof entry.transferSize === 'number' && typeof entry.decodedBodySize === 'number') {
		if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
			return true
		}

		if (entry.transferSize > 0) {
			return false
		}
	}

	return undefined
}
