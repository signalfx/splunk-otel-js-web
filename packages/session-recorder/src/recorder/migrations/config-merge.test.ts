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
import { mergeRecorderConfig } from './config-merge'
import { SplunkRecorderPublicConfig } from '../splunk-recorder'

describe('mergeRecorderConfig', () => {
	it('merges recorder configs', () => {
		const config = {
			maskAllInputs: true,
			features: {
				canvas: true,
				packAssets: {
					images: true,
				},
			},
			sensitivityRules: [{ rule: 'mask', selector: '.mask' }],
		} satisfies SplunkRecorderPublicConfig

		const migratedConfig = {
			maskAllInputs: false,
			features: {
				packAssets: {
					styles: true,
				},
			},
			sensitivityRules: [{ rule: 'exclude', selector: '.exclude' }],
		} satisfies SplunkRecorderPublicConfig

		const actual = mergeRecorderConfig(config, migratedConfig)
		const expected = {
			maskAllInputs: true,
			features: {
				canvas: true,
				packAssets: {
					images: true,
					styles: true,
				},
			},
			sensitivityRules: [
				{ rule: 'mask', selector: '.mask' },
				{ rule: 'exclude', selector: '.exclude' },
			],
		}

		expect(actual).toStrictEqual(expected)
	})

	it('merges recorder configs - config overrides migrated config', () => {
		const config = {
			features: {
				packAssets: true,
			},
		}
		const migratedConfig = {
			features: {
				packAssets: {
					styles: true,
				},
			},
		}

		const actual = mergeRecorderConfig(config, migratedConfig)
		const expected = {
			features: {
				packAssets: true,
			},
		}

		expect(actual).toStrictEqual(expected)
	})
})
