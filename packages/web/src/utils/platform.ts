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

export function getBasicPlatformInfo() {
	const userAgentData = navigator.userAgentData
	return {
		'user_agent.language': navigator.language,
		'user_agent.mobile': userAgentData?.mobile,
		'user_agent.original': navigator.userAgent,
		'user_agent.os.name': userAgentData?.platform || navigator.platform,
	}
}

/**
 * Gets enhanced platform information using User Agent Client Hints API
 * Falls back to basic info if the API is not available
 */
export async function getEnhancedPlatformInfo() {
	const basicInfo = getBasicPlatformInfo()

	// Check if User Agent Client Hints API is available
	if (!navigator.userAgentData?.getHighEntropyValues) {
		return basicInfo
	}

	try {
		const highEntropy = await navigator.userAgentData.getHighEntropyValues(['platformVersion'])

		if (highEntropy?.platformVersion) {
			return {
				...basicInfo,
				'user_agent.os.version': highEntropy.platformVersion,
			}
		}

		return basicInfo
	} catch (error) {
		// If high entropy values fail (e.g., user denied permission), return basic info
		console.warn('[Splunk]: Could not get enhanced platform information:', error)
		return basicInfo
	}
}
