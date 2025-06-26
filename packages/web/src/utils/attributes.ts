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
type AttributeValue = string | number | boolean

export interface SpanContext {
	[key: string]: AttributeValue
}

export const isPlainObject = (object: unknown): object is Record<string, unknown> => {
	if (Object.prototype.toString.call(object) !== '[object Object]') {
		return false
	}

	const prototype = Object.getPrototypeOf(object)
	return prototype === null || prototype === Object.prototype
}

export const getValidAttributes = (data: unknown): SpanContext => {
	if (!isPlainObject(data)) {
		return {}
	}

	return removePropertiesWithAdvancedTypes(removeEmptyProperties(data))
}

export const removePropertiesWithAdvancedTypes = (data: Record<string, unknown>): SpanContext => {
	const newData: Record<string, AttributeValue> = {}

	for (const [key, value] of Object.entries(data)) {
		if (isAttributeValue(value)) {
			newData[key] = value
		}
	}

	return newData
}

export const removeEmptyProperties = (data: Record<string, unknown>): Record<string, unknown> => {
	const newData = { ...data }

	Object.entries(newData).forEach(([propertyKey, propertyValue]) => {
		if (propertyValue === '' || propertyValue === undefined || propertyValue === null) {
			delete newData[propertyKey]
		}
	})

	return newData
}

export const isAttributeValue = (value: unknown): value is AttributeValue =>
	typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
