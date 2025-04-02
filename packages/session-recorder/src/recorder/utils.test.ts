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
import { migrateRRWebConfigToProprietary } from './utils'

describe('migrateRRWebConfigToProprietary', () => {
	it('migrates rrweb config to proprietary', () => {
		const actual = migrateRRWebConfigToProprietary({
			maskAllInputs: true,
			maskTextClass: 'mask-class',
			maskTextSelector: '.mask-selector',
			blockClass: 'block-class',
			blockSelector: '.block-selector',
		})
		const expected = {
			maskAllInputs: true,
			sensitivityRules: [
				{ rule: 'mask', selector: '.mask-class' },
				{ rule: 'mask', selector: '.mask-selector' },
				{ rule: 'exclude', selector: '.block-class' },
				{ rule: 'exclude', selector: '.block-selector' },
			],
		}
		expect(actual).toStrictEqual(expected)
	})

	it('migrate default rrweb mask and block classes to sensitivity rules', () => {
		const actual = migrateRRWebConfigToProprietary({})
		const expected = {
			maskAllInputs: undefined,
			sensitivityRules: [
				{ rule: 'mask', selector: '.rr-mask' },
				{ rule: 'exclude', selector: '.rr-block' },
			],
		}
		expect(actual).toStrictEqual(expected)
	})
})
