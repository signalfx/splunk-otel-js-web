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

import { Span } from '@opentelemetry/api'

import { isNumber, isString } from '../../types'
import { LayoutShiftRect } from './types'

export function setAttributes(span: Span, attributes: Record<string, number | string>): void {
	for (const [name, value] of Object.entries(attributes)) {
		if (isNumber(value)) {
			setNumberAttribute(span, name, value)
		} else {
			setStringAttribute(span, name, value)
		}
	}
}

export function setNumberAttribute(span: Span, name: string, value: number | undefined): void {
	if (isNumber(value) && Number.isFinite(value)) {
		span.setAttribute(name, value)
	}
}

export function setRectAttributes(span: Span, prefix: string, rect: LayoutShiftRect | undefined): void {
	if (!rect) {
		return
	}

	setNumberAttribute(span, `${prefix}.x`, rect.x)
	setNumberAttribute(span, `${prefix}.y`, rect.y)
	setNumberAttribute(span, `${prefix}.width`, rect.width)
	setNumberAttribute(span, `${prefix}.height`, rect.height)
}

export function setStringAttribute(span: Span, name: string, value: string | undefined): void {
	if (isString(value)) {
		span.setAttribute(name, value)
	}
}
