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
import { SplunkRecorderPublicConfig } from '../splunk-recorder'
import { RRWebRecorderPublicConfig } from '../rrweb-recorder'
import { SensitivityRule, SensitivityRuleType } from '../../session-replay'
import { isString } from '../../type-guards'

export const migrateRRWebConfigToSplunkConfig = (
	config: NonNullable<RRWebRecorderPublicConfig>,
): SplunkRecorderPublicConfig => ({
	maskAllInputs: config.maskAllInputs,
	sensitivityRules: migratePrivacyOptionsToSensitivityRules(config),
})

const migratePrivacyOptionsToSensitivityRules = ({
	maskTextClass = 'rr-mask',
	maskTextSelector,
	blockClass = 'rr-block',
	blockSelector,
	ignoreClass = 'rr-ignore',
	maskInputFn,
	maskTextFn,
	maskInputOptions,
}: NonNullable<RRWebRecorderPublicConfig>): SensitivityRule[] | undefined => {
	if (maskInputFn) {
		throwOnUnsupportedOption('Config option "maskInputFn" cannot be migrated automatically.')
	}

	if (maskTextFn) {
		throwOnUnsupportedOption('Config option "maskTextFn" cannot be migrated automatically.')
	}

	if (maskInputOptions) {
		throwOnUnsupportedOption('Config option "maskInputOptions" cannot be migrated automatically.')
	}

	const rules: SensitivityRule[] = []

	// Mask
	rules.push(...migratePrivacyClass(maskTextClass, 'mask'))
	rules.push(...migratePrivacySelector(maskTextSelector, 'mask'))

	// Block
	rules.push(...migratePrivacyClass(blockClass, 'exclude'))
	rules.push(...migratePrivacySelector(blockSelector, 'exclude'))

	// Ignore
	rules.push(...migratePrivacyClass(ignoreClass, 'mask'))

	return rules.length > 0 ? rules : undefined
}

const migratePrivacyClass = (privacyClass: string | RegExp, rule: SensitivityRuleType): SensitivityRule[] => {
	const rules: SensitivityRule[] = []

	if (isString(privacyClass)) {
		rules.push({ rule, selector: `.${privacyClass}` })
	} else {
		// Privacy class is a regex: Cannot be converted to a selector => throw error
		throwOnUnsupportedOption(`Privacy class is a regex: ${privacyClass}. Cannot be converted to a CSS selector.`)
	}

	return rules
}

const migratePrivacySelector = (privacySelector: string | undefined, rule: SensitivityRuleType): SensitivityRule[] => {
	if (isString(privacySelector) && privacySelector.length > 0) {
		return [{ rule, selector: privacySelector }]
	}

	return []
}

const throwOnUnsupportedOption = (errorMessage: string) => {
	throw new Error(`Config migration failed: ${errorMessage}`)
}
