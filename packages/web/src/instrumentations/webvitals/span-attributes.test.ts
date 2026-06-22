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

import { createSpanMock } from '@/tests/utils'

import { setRectAttributes } from './span-attributes'

describe('webvitals span attribute helpers', () => {
	it('expands layout shift rectangles into prefixed attributes', () => {
		const { attributes, span } = createSpanMock()

		setRectAttributes(span, 'cls.largest_shift_source.current_rect', {
			height: 40,
			width: 30,
			x: 10,
			y: 20,
		})
		setRectAttributes(span, 'cls.largest_shift_source.previous_rect', undefined)

		expect(attributes).toEqual({
			'cls.largest_shift_source.current_rect.height': 40,
			'cls.largest_shift_source.current_rect.width': 30,
			'cls.largest_shift_source.current_rect.x': 10,
			'cls.largest_shift_source.current_rect.y': 20,
		})
	})
})
