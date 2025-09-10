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
const DEFAULT_CREDIT_CARD_IDENTIFIERS = ['card', 'credit', 'expiry', 'cvv', 'cvc']

// https://html.spec.whatwg.org/multipage/form-control-infrastructure.html
const OFFICIAL_CREDIT_CARDS_AUTOCOMPLETE_IDENTIFIERS = [
	'cc-name',
	'cc-given-name',
	'cc-additional-name',
	'cc-family-name',
	'cc-number',
	'cc-exp',
	'cc-exp-month',
	'cc-exp-year',
	'cc-csc',
	'cc-type',
]

export const isCreditCardInput = (inputElement: HTMLInputElement): boolean => {
	const autocompleteValue = (inputElement.getAttribute('autocomplete') ?? '').toLowerCase()
	if (
		autocompleteValue &&
		OFFICIAL_CREDIT_CARDS_AUTOCOMPLETE_IDENTIFIERS.some((creditCardAutocompleteValue) =>
			autocompleteValue.includes(creditCardAutocompleteValue),
		)
	) {
		return true
	}

	return Array.from(inputElement.attributes)
		.filter((attribute) => attribute.name !== 'value')
		.flatMap((attribute) => [attribute.name, attribute.value])
		.some((attributeNameOrValue) =>
			DEFAULT_CREDIT_CARD_IDENTIFIERS.some((creditCardIdentifier) =>
				attributeNameOrValue.toLowerCase().includes(creditCardIdentifier),
			),
		)
}

export const excludedInputTypes = new Set<string>(['file', 'password'])
