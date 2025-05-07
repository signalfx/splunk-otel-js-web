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
import { describe, it, expect } from 'vitest'
import { migrateRRWebConfigToSplunkConfig } from './config-migration'

const defaultSensitivityRules = [
	{ rule: 'mask', selector: '.rr-mask' },
	{ rule: 'exclude', selector: '.rr-block' },
	{ rule: 'mask', selector: '.rr-ignore' },
]

describe('migrateRRWebConfigToSplunkConfig', () => {
	it('migrates rrweb config to splunk config', () => {
		const actual = migrateRRWebConfigToSplunkConfig({
			maskAllInputs: true,
			maskTextClass: 'mask-class',
			maskTextSelector: '.mask-selector',
			blockClass: 'block-class',
			blockSelector: '.block-selector',
			ignoreClass: 'ignore-class',
		})
		const expected = {
			maskAllInputs: true,
			sensitivityRules: [
				{ rule: 'mask', selector: '.mask-class' },
				{ rule: 'mask', selector: '.mask-selector' },
				{ rule: 'exclude', selector: '.block-class' },
				{ rule: 'exclude', selector: '.block-selector' },
				{ rule: 'mask', selector: '.ignore-class' },
			],
		}
		expect(actual).toStrictEqual(expected)
	})

	it('migrate default rrweb mask and block classes to sensitivity rules', () => {
		const actual = migrateRRWebConfigToSplunkConfig({})
		const expected = {
			maskAllInputs: undefined,
			sensitivityRules: defaultSensitivityRules,
		}
		expect(actual).toStrictEqual(expected)
	})

	it('ignores maskTextSelector with invalid values', () => {
		// Empty string
		const actualEmptyString = migrateRRWebConfigToSplunkConfig({
			maskTextSelector: '',
		})
		const expectedEmptyString = {
			maskAllInputs: undefined,
			sensitivityRules: defaultSensitivityRules,
		}
		expect(actualEmptyString).toStrictEqual(expectedEmptyString)

		// Boolean
		const actualBool = migrateRRWebConfigToSplunkConfig({
			// @ts-expect-error Boolean value
			maskTextSelector: false,
		})
		const expectedBool = {
			maskAllInputs: undefined,
			sensitivityRules: defaultSensitivityRules,
		}
		expect(actualBool).toStrictEqual(expectedBool)
	})

	it('throws error for regex privacy class', () => {
		const privacyClass = /regex/
		expect(() => {
			migrateRRWebConfigToSplunkConfig({ maskTextClass: privacyClass })
		}).toThrowError(
			`Config migration failed: Privacy class is a regex: ${privacyClass}. Cannot be converted to a CSS selector.`,
		)
	})

	it('throws error for unsupported options', () => {
		const unsupportedOptions = ['maskInputFn', 'maskTextFn', 'maskInputOptions']

		unsupportedOptions.forEach((option) => {
			expect(() => {
				migrateRRWebConfigToSplunkConfig({ [option]: true })
			}).toThrowError(`Config option "${option}" cannot be migrated automatically.`)
		})
	})
})
