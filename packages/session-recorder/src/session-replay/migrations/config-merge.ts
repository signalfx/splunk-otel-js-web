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
import { isObject } from '../../type-guards'
import { RecorderPublicConfig } from '../recorder'

export const mergeRecorderConfig = (
	config: RecorderPublicConfig,
	migratedConfig: RecorderPublicConfig,
): RecorderPublicConfig => {
	const mergedConfig: RecorderPublicConfig = { ...migratedConfig, ...config }

	// Merge features
	if (config.features || migratedConfig.features) {
		const mergedFeatures = { ...migratedConfig.features, ...config.features }

		// Merge packAssets
		if (config.features?.packAssets && isObject(config.features.packAssets)) {
			const migratedPackAssets =
				migratedConfig.features?.packAssets && isObject(migratedConfig.features.packAssets)
					? migratedConfig.features.packAssets
					: {}

			const mergedPackAssets = { ...migratedPackAssets, ...config.features.packAssets }

			if (Object.keys(mergedPackAssets).length > 0) {
				mergedFeatures.packAssets = mergedPackAssets
			}
		}

		if (Object.keys(mergedFeatures).length > 0) {
			mergedConfig.features = mergedFeatures
		}
	}

	// Merge sensitivity rules
	if (config.sensitivityRules || migratedConfig.sensitivityRules) {
		const mergedRules = [...(config.sensitivityRules ?? []), ...(migratedConfig.sensitivityRules ?? [])]
		if (mergedRules.length > 0) {
			mergedConfig.sensitivityRules = mergedRules
		}
	}

	return mergedConfig
}
