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

import type { ExtendedNavigator } from '../types'

export interface PlatformBasicInfo {
	'user_agent.language': string
	'user_agent.mobile'?: boolean
	'user_agent.original': string
	'user_agent.os.name': string
}
export interface PlatformInfo extends PlatformBasicInfo {
	'user_agent.os.version'?: string
}

export function getBasicPlatformInfo(): PlatformBasicInfo {
	const extendedNavigator = navigator as ExtendedNavigator
	const userAgentData = extendedNavigator.userAgentData
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
export async function getEnhancedPlatformInfo(): Promise<PlatformInfo> {
	const basicInfo = getBasicPlatformInfo()
	const extendedNavigator = navigator as ExtendedNavigator

	// Check if User Agent Client Hints API is available
	if (!extendedNavigator.userAgentData?.getHighEntropyValues) {
		return basicInfo
	}

	try {
		const highEntropy = await extendedNavigator.userAgentData.getHighEntropyValues(['platformVersion'])

		if (highEntropy.platformVersion) {
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
