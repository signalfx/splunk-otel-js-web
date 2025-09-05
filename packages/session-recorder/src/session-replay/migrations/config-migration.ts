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
import { isString } from '../../type-guards'
import { ConfigFeatures, PackAssetsConfig, SensitivityRule, SensitivityRuleType } from '../cdn-module'
import { RecorderPublicConfig } from '../recorder'

export const migrateRRWebConfigToSplunkConfig = (
	config: NonNullable<Record<string, unknown>>,
): RecorderPublicConfig => ({
	features: migrateConfigToFeatures(config),
	maskAllInputs: config.maskAllInput === undefined ? true : Boolean(config.maskAllInput),
	sensitivityRules: migratePrivacyOptionsToSensitivityRules(config),
})

const migrateConfigToFeatures = ({
	collectFonts,
	inlineImages,
	inlineStylesheet,
	recordCanvas,
}: NonNullable<Record<string, unknown>>): ConfigFeatures | undefined => {
	const features: ConfigFeatures = {}
	const packAssets: PackAssetsConfig = {}

	if (recordCanvas === true) {
		features.canvas = true
	}

	if (inlineStylesheet === true) {
		packAssets.styles = true
	}

	if (inlineImages === true) {
		packAssets.images = true
	}

	if (collectFonts === true) {
		packAssets.fonts = true
	}

	if (Object.keys(packAssets).length > 0) {
		features.packAssets = packAssets
	}

	return Object.keys(features).length > 0 ? features : undefined
}

const migratePrivacyOptionsToSensitivityRules = ({
	blockClass = 'rr-block',
	blockSelector,
	ignoreClass = 'rr-ignore',
	maskInputFn,
	maskInputOptions,
	maskTextClass = 'rr-mask',
	maskTextFn,
	maskTextSelector,
}: NonNullable<Record<string, unknown>>): SensitivityRule[] | undefined => {
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

	/* eslint-disable unicorn/prefer-single-call */
	// Mask
	rules.push(...migratePrivacyClass(maskTextClass, 'mask'))
	rules.push(...migratePrivacySelector(maskTextSelector, 'mask'))

	// Block
	rules.push(...migratePrivacyClass(blockClass, 'exclude'))
	rules.push(...migratePrivacySelector(blockSelector, 'exclude'))

	// Ignore
	rules.push(...migratePrivacyClass(ignoreClass, 'mask'))
	/* eslint-enable unicorn/prefer-single-call */

	return rules.length > 0 ? rules : undefined
}

const migratePrivacyClass = (privacyClass: unknown, rule: SensitivityRuleType): SensitivityRule[] => {
	const rules: SensitivityRule[] = []

	if (isString(privacyClass)) {
		rules.push({ rule, selector: `.${privacyClass}` })
	} else {
		// Privacy class is a regex: Cannot be converted to a selector => throw error
		throwOnUnsupportedOption(`Privacy class is a regex: ${privacyClass}. Cannot be converted to a CSS selector.`)
	}

	return rules
}

const migratePrivacySelector = (privacySelector: unknown, rule: SensitivityRuleType): SensitivityRule[] => {
	if (isString(privacySelector) && privacySelector.length > 0) {
		return [{ rule, selector: privacySelector }]
	}

	return []
}

const throwOnUnsupportedOption = (errorMessage: string) => {
	throw new Error(`Config migration failed: ${errorMessage}`)
}
