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
import { ProprietaryRecorderPublicConfig } from './proprietary-recorder'
import { RRWebRecorderPublicConfig } from './rrweb-recorder'
import { SensitivityRule, SensitivityRuleType } from '../session-replay'

export const migrateRRWebConfigToProprietary = (
	config: NonNullable<RRWebRecorderPublicConfig>,
): ProprietaryRecorderPublicConfig => ({
	maskAllInputs: config.maskAllInputs,
	sensitivityRules: migratePrivacyOptionsToSensitivityRules(config),
})

const migratePrivacyOptionsToSensitivityRules = ({
	maskTextClass = 'rr-mask',
	maskTextSelector,
	blockClass = 'rr-block',
	blockSelector,
}: NonNullable<RRWebRecorderPublicConfig>): SensitivityRule[] | undefined => {
	const rules: SensitivityRule[] = []

	// Masking
	rules.push(...migratePrivacyClass(maskTextClass, 'mask'))
	rules.push(...migratePrivacySelector(maskTextSelector, 'mask'))

	// Blocking
	rules.push(...migratePrivacyClass(blockClass, 'exclude'))
	rules.push(...migratePrivacySelector(blockSelector, 'exclude'))

	return rules.length > 0 ? rules : undefined
}

const migratePrivacyClass = (privacyClass: string | RegExp, rule: SensitivityRuleType): SensitivityRule[] => {
	const rules: SensitivityRule[] = []

	if (typeof privacyClass === 'string') {
		rules.push({ rule, selector: `.${privacyClass}` })
	}

	// TODO: Convert regex class?

	return rules
}

const migratePrivacySelector = (privacySelector: string | undefined, rule: SensitivityRuleType): SensitivityRule[] => {
	if (privacySelector) {
		return [{ rule, selector: privacySelector }]
	}

	return []
}
