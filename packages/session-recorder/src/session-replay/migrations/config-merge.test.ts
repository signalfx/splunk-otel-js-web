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
import { describe, expect, it } from 'vitest'

import { RecorderPublicConfig } from '../recorder'
import { mergeRecorderConfig } from './config-merge'

describe('mergeRecorderConfig', () => {
	it('merges recorder configs', () => {
		const config: RecorderPublicConfig = {
			features: {
				canvas: true,
				packAssets: {
					images: true,
				},
			},
			maskAllInputs: true,
			sensitivityRules: [{ rule: 'mask', selector: '.mask' }],
		}

		const migratedConfig: RecorderPublicConfig = {
			features: {
				packAssets: {
					styles: true,
				},
			},
			maskAllInputs: false,
			sensitivityRules: [{ rule: 'exclude', selector: '.exclude' }],
		}

		const actual = mergeRecorderConfig(config, migratedConfig)
		const expected = {
			features: {
				canvas: true,
				packAssets: {
					images: true,
					styles: true,
				},
			},
			maskAllInputs: true,
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
