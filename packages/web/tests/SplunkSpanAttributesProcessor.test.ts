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

import { expect, describe, it } from 'vitest'
import { SplunkSpanAttributesProcessor } from '../src/SplunkSpanAttributesProcessor'

describe('SplunkSpanAttributesProcessor', () => {
	describe('setting global attribute', () => {
		it('should set attributes via constructor', () => {
			const processor = new SplunkSpanAttributesProcessor(
				{
					key1: 'value1',
				},
				false,
				() => false,
			)

			expect(processor.getGlobalAttributes()).toStrictEqual({
				key1: 'value1',
			})
		})

		it('should patch attributes via .setGlobalAttributes()', () => {
			const processor = new SplunkSpanAttributesProcessor(
				{
					key1: 'value1',
					key2: 'value2',
				},
				false,
				() => false,
			)

			processor.setGlobalAttributes({
				key2: 'value2-updaged',
				key3: 'value3',
			})

			expect(processor.getGlobalAttributes()).toStrictEqual({
				key1: 'value1',
				key2: 'value2-updaged',
				key3: 'value3',
			})
		})
	})
})
