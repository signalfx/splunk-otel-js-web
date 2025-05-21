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
import { migrateRRWebConfigToSplunkConfig } from './migrations/config-migration'
import { SplunkRecorderPublicConfig } from './splunk-recorder'
import { RRWebRecorderPublicConfig } from './rrweb-recorder'

export const getSplunkRecorderConfig = (
	config: SplunkRecorderPublicConfig & RRWebRecorderPublicConfig,
): SplunkRecorderPublicConfig => {
	const migratedRRWebConfig = migrateRRWebConfigToSplunkConfig(config)

	const splunkConfig = {
		...config,
		...migratedRRWebConfig,
	}

	// Merge sensitivity rules
	if (config.sensitivityRules || migratedRRWebConfig.sensitivityRules) {
		const mergedRules = [...(config.sensitivityRules ?? []), ...(migratedRRWebConfig.sensitivityRules ?? [])]
		if (mergedRules.length > 0) {
			splunkConfig.sensitivityRules = mergedRules
		}
	}

	return splunkConfig
}
