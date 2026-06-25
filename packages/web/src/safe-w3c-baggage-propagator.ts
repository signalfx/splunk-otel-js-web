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

// Use version 2.8.0 that contains security fix

import {
	Baggage,
	BaggageEntry,
	baggageEntryMetadataFromString,
	Context,
	propagation,
	TextMapGetter,
	TextMapPropagator,
	TextMapSetter,
} from '@opentelemetry/api'
import { isTracingSuppressed } from '@opentelemetry/core'

const BAGGAGE_HEADER = 'baggage'
const BAGGAGE_ITEMS_SEPARATOR = ','
const BAGGAGE_KEY_PAIR_SEPARATOR = '='
const BAGGAGE_MAX_NAME_VALUE_PAIRS = 180
const BAGGAGE_MAX_PER_NAME_VALUE_PAIRS = 4096
const BAGGAGE_MAX_TOTAL_LENGTH = 8192
const BAGGAGE_PROPERTIES_SEPARATOR = ';'

type ParsedBaggageKeyValue = {
	key: string
	metadata?: ReturnType<typeof baggageEntryMetadataFromString>
	value: string
}

/**
 * Propagates {@link Baggage} through Context format propagation.
 *
 * Based on the Baggage specification:
 * https://w3c.github.io/baggage/
 */
export class SafeW3CBaggagePropagator implements TextMapPropagator {
	extract(context: Context, carrier: unknown, getter: TextMapGetter): Context {
		const headerValue = getter.get(carrier, BAGGAGE_HEADER)
		if (!headerValue) {
			return context
		}

		const baggage: Record<string, BaggageEntry> = {}
		let count = 0

		let totalSize = 0
		if (Array.isArray(headerValue)) {
			for (const element of headerValue) {
				;[count, totalSize] = parseBaggageHeaderString(element, baggage, count, totalSize)
			}
		} else {
			;[count] = parseBaggageHeaderString(headerValue, baggage, count, totalSize)
		}

		if (count === 0) {
			return context
		}

		return propagation.setBaggage(context, propagation.createBaggage(baggage))
	}

	fields(): string[] {
		return [BAGGAGE_HEADER]
	}

	inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
		const baggage = propagation.getBaggage(context)
		if (!baggage || isTracingSuppressed(context)) {
			return
		}

		const keyPairs = getKeyPairs(baggage)
			.filter((pair: string) => pair.length <= BAGGAGE_MAX_PER_NAME_VALUE_PAIRS)
			.slice(0, BAGGAGE_MAX_NAME_VALUE_PAIRS)
		const headerValue = serializeKeyPairs(keyPairs)
		if (headerValue.length > 0) {
			setter.set(carrier, BAGGAGE_HEADER, headerValue)
		}
	}
}

function serializeKeyPairs(keyPairs: string[]): string {
	return keyPairs.reduce((headerValue, current) => {
		const value = `${headerValue}${headerValue === '' ? '' : BAGGAGE_ITEMS_SEPARATOR}${current}`
		return value.length <= BAGGAGE_MAX_TOTAL_LENGTH ? value : headerValue
	}, '')
}

export function getKeyPairs(baggage: Baggage): string[] {
	return baggage.getAllEntries().map(([key, value]) => {
		let entry = `${encodeURIComponent(key)}=${encodeURIComponent(value.value)}`

		// include opaque metadata if provided
		// NOTE: we intentionally don't URI-encode the metadata - that responsibility falls on the metadata implementation
		if (value.metadata !== undefined) {
			entry += BAGGAGE_PROPERTIES_SEPARATOR + value.metadata.toString()
		}

		return entry
	})
}

export function parsePairKeyValue(entry: string): ParsedBaggageKeyValue | undefined {
	if (!entry) {
		return
	}

	const metadataSeparatorIndex = entry.indexOf(BAGGAGE_PROPERTIES_SEPARATOR)
	const keyPairPart = metadataSeparatorIndex === -1 ? entry : entry.slice(0, Math.max(0, metadataSeparatorIndex))

	const separatorIndex = keyPairPart.indexOf(BAGGAGE_KEY_PAIR_SEPARATOR)
	if (separatorIndex <= 0) {
		return
	}

	const rawKey = keyPairPart.slice(0, Math.max(0, separatorIndex)).trim()
	const rawValue = keyPairPart.slice(Math.max(0, separatorIndex + 1)).trim()

	if (!rawKey || !rawValue) {
		return
	}

	let key: string
	let value: string
	try {
		key = decodeURIComponent(rawKey)
		value = decodeURIComponent(rawValue)
	} catch {
		return
	}

	let metadata
	if (metadataSeparatorIndex !== -1 && metadataSeparatorIndex < entry.length - 1) {
		const metadataString = entry.slice(Math.max(0, metadataSeparatorIndex + 1))
		metadata = baggageEntryMetadataFromString(metadataString)
	}

	return { key, metadata, value }
}

/**
 * Parses a single baggage header string into the provided record, applying limits defined in this package.
 * Uses indexOf/substring in a while loop to avoid allocating a full array of split entries.
 * Returns the updated pair count so callers can track totals across multiple header values.
 */
export function parseBaggageHeaderString(
	value: string,
	baggage: Record<string, BaggageEntry>,
	count: number,
	totalSize: number,
): [count: number, totalSize: number] {
	let start = 0
	while (start < value.length && count < BAGGAGE_MAX_NAME_VALUE_PAIRS) {
		const end = value.indexOf(BAGGAGE_ITEMS_SEPARATOR, start)
		const entryEnd = end === -1 ? value.length : end
		const entryLength = entryEnd - start

		if (entryLength <= BAGGAGE_MAX_PER_NAME_VALUE_PAIRS) {
			// eslint-disable-next-line unicorn/prefer-string-slice
			const keyPair = parsePairKeyValue(value.substring(start, entryEnd))
			if (keyPair) {
				// Comma separator is counted for every accepted entry after the first
				const entrySize = (count === 0 ? 0 : 1) + entryLength
				if (totalSize + entrySize > BAGGAGE_MAX_TOTAL_LENGTH) {
					break
				}

				baggage[keyPair.key] = keyPair.metadata
					? { metadata: keyPair.metadata, value: keyPair.value }
					: { value: keyPair.value }
				count += 1
				totalSize += entrySize
			}
		}

		if (end === -1) {
			break
		}

		start = end + 1
	}
	return [count, totalSize]
}
