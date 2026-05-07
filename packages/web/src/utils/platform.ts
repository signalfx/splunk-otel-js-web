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

import { Attributes } from '@opentelemetry/api'

import { isValidAttributeValue } from './attributes'
import { isBot } from './is-bot'

type PlatformInfoOptions = {
	includeDebugInfo?: boolean
}

type BrandVersion = {
	brand: string
	version: string
}

type StorageEstimateWithDetails = StorageEstimate & {
	usageDetails?: Record<string, number | undefined>
}

const HIGH_ENTROPY_HINTS = [
	'architecture',
	'bitness',
	'fullVersionList',
	'model',
	'platformVersion',
	'uaFullVersion',
	'wow64',
]

function serializeDebugAttributeValue(value: unknown): unknown {
	return Array.isArray(value) ? JSON.stringify(value) : value
}

function setDebugAttribute(attributes: Attributes, key: string, getValue: () => unknown): void {
	let value: unknown

	try {
		value = serializeDebugAttributeValue(getValue())
	} catch {
		// Skip unavailable browser debug fields without dropping the whole attribute set.
		return
	}

	if (isValidAttributeValue(value)) {
		attributes[key] = value
	}
}

function formatBrandVersions(brandVersions: BrandVersion[] | undefined): string[] | undefined {
	return brandVersions?.map(({ brand, version }) => `${brand}/${version}`)
}

function toSnakeCase(value: string): string {
	return value.replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function getBasicBrowserDebugInfo(): Attributes {
	const attributes: Attributes = {}

	setDebugAttribute(attributes, 'browser.debug.hardware_concurrency', () => navigator.hardwareConcurrency)
	setDebugAttribute(attributes, 'browser.debug.device_memory_gb', () => navigator.deviceMemory)
	setDebugAttribute(attributes, 'browser.debug.max_touch_points', () => navigator.maxTouchPoints)
	setDebugAttribute(attributes, 'browser.debug.cookie_enabled', () => navigator.cookieEnabled)
	setDebugAttribute(attributes, 'browser.debug.do_not_track', () => navigator.doNotTrack)
	setDebugAttribute(attributes, 'browser.debug.languages', () =>
		navigator.languages ? [...navigator.languages] : undefined,
	)
	setDebugAttribute(attributes, 'browser.debug.vendor', () => navigator.vendor)
	setDebugAttribute(attributes, 'browser.debug.pdf_viewer_enabled', () => navigator.pdfViewerEnabled)
	setDebugAttribute(attributes, 'browser.debug.online', () => navigator.onLine)

	setDebugAttribute(attributes, 'browser.debug.connection.type', () => navigator.connection?.type)
	setDebugAttribute(attributes, 'browser.debug.connection.effective_type', () => navigator.connection?.effectiveType)
	setDebugAttribute(attributes, 'browser.debug.connection.downlink', () => navigator.connection?.downlink)
	setDebugAttribute(attributes, 'browser.debug.connection.rtt', () => navigator.connection?.rtt)
	setDebugAttribute(attributes, 'browser.debug.connection.save_data', () => navigator.connection?.saveData)

	setDebugAttribute(attributes, 'browser.debug.ua.brands', () => formatBrandVersions(navigator.userAgentData?.brands))

	return attributes
}

function getHighEntropyBrowserDebugInfo(
	highEntropy: Awaited<ReturnType<NonNullable<Navigator['userAgentData']>['getHighEntropyValues']>>,
): Attributes {
	const attributes: Attributes = {}

	setDebugAttribute(attributes, 'browser.debug.ua.architecture', () => highEntropy?.architecture)
	setDebugAttribute(attributes, 'browser.debug.ua.bitness', () => highEntropy?.bitness)
	setDebugAttribute(attributes, 'browser.debug.ua.full_version', () => highEntropy?.uaFullVersion)
	setDebugAttribute(attributes, 'browser.debug.ua.full_version_list', () =>
		formatBrandVersions(highEntropy?.fullVersionList),
	)
	setDebugAttribute(attributes, 'browser.debug.ua.model', () => highEntropy?.model)
	setDebugAttribute(attributes, 'browser.debug.ua.wow64', () => highEntropy?.wow64)

	return attributes
}

async function getStorageDebugInfo(): Promise<Attributes> {
	const attributes: Attributes = {}

	try {
		if (!navigator.storage?.estimate) {
			return attributes
		}

		const estimate = (await navigator.storage.estimate()) as StorageEstimateWithDetails

		setDebugAttribute(attributes, 'browser.debug.storage.quota', () => estimate.quota)
		setDebugAttribute(attributes, 'browser.debug.storage.usage', () => estimate.usage)

		for (const [key, value] of Object.entries(estimate.usageDetails ?? {})) {
			setDebugAttribute(attributes, `browser.debug.storage.usage_details.${toSnakeCase(key)}`, () => value)
		}
	} catch (error) {
		console.warn('[Splunk]: Could not get browser storage debug information:', error)
	}

	return attributes
}

export function getBasicPlatformInfo(options: PlatformInfoOptions = {}) {
	const userAgentData = navigator.userAgentData
	const basicInfo = {
		'user_agent.is_automated': !!navigator.webdriver,
		'user_agent.is_bot': isBot(navigator.userAgent),
		'user_agent.language': navigator.language,
		'user_agent.mobile': userAgentData?.mobile,
		'user_agent.original': navigator.userAgent,
		'user_agent.os.name': userAgentData?.platform || navigator.platform,
	}

	if (!options.includeDebugInfo) {
		return basicInfo
	}

	return {
		...basicInfo,
		...getBasicBrowserDebugInfo(),
	}
}

/**
 * Gets enhanced platform information using User Agent Client Hints API
 * Falls back to basic info if the API is not available
 */
export async function getEnhancedPlatformInfo(options: PlatformInfoOptions = {}) {
	const basicInfo = getBasicPlatformInfo(options)
	const storageDebugInfo = options.includeDebugInfo ? await getStorageDebugInfo() : {}

	// Check if User Agent Client Hints API is available
	if (!navigator.userAgentData?.getHighEntropyValues) {
		return {
			...basicInfo,
			...storageDebugInfo,
		}
	}

	try {
		const highEntropy = await navigator.userAgentData.getHighEntropyValues(
			options.includeDebugInfo ? HIGH_ENTROPY_HINTS : ['platformVersion'],
		)
		const enhancedInfo = {
			...basicInfo,
			...storageDebugInfo,
			...(options.includeDebugInfo ? getHighEntropyBrowserDebugInfo(highEntropy) : {}),
		}

		if (highEntropy?.platformVersion) {
			return {
				...enhancedInfo,
				'user_agent.os.version': highEntropy.platformVersion,
			}
		}

		return enhancedInfo
	} catch (error) {
		// If high entropy values fail (e.g., user denied permission), return basic info
		console.warn('[Splunk]: Could not get enhanced platform information:', error)
		return {
			...basicInfo,
			...storageDebugInfo,
		}
	}
}
