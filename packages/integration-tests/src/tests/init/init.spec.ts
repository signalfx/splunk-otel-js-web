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
import { expect } from '@playwright/test'
import { test } from '../../utils/test'
import { VERSION } from '../../version'

test.describe('init', () => {
	test('No spans sent when no beacon url set', async ({ recordPage }) => {
		await recordPage.goTo('/init/no-beacon.ejs')
		await recordPage.waitForTimeout(1000)

		expect(recordPage.receivedSpans).toHaveLength(0)
	})

	test('attribute-related config should work', async ({ recordPage }) => {
		await recordPage.goTo('/init/attributes.ejs')
		await recordPage.waitForTimeout(1000)

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentLoad').length === 1)
		const documentLoadSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentLoad')

		expect(documentLoadSpans).toHaveLength(1)

		expect(documentLoadSpans[0].tags['app']).toBe('custom-app')
		expect(documentLoadSpans[0].tags['environment']).toBe('custom-environment')
		expect(documentLoadSpans[0].tags['key1']).toBe('value1')
		expect(documentLoadSpans[0].tags['key2']).toBe('value2')

		await recordPage.locator('#clickToChangeAttributes').click()

		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'attributes-set').length === 1)
		const attributeSetSpans = recordPage.receivedSpans.filter((span) => span.name === 'attributes-set')

		expect(attributeSetSpans).toHaveLength(1)

		expect(attributeSetSpans[0].tags['environment']).toBe('custom-environment')
		expect(attributeSetSpans[0].tags['key1']).toBe('newvalue1')
		expect(attributeSetSpans[0].tags['key2']).toBe('value2')

		const attributesChangedSpans = recordPage.receivedSpans.filter((span) => span.name === 'attributes-changed')
		expect(attributesChangedSpans).toHaveLength(1)

		const notifiedAttrs = JSON.parse(attributesChangedSpans[0].tags['payload'] as string).attributes
		expect(notifiedAttrs.environment, 'custom-environment')
		expect(notifiedAttrs.key1, 'newvalue1')
		expect(notifiedAttrs.key2, 'value2')

		await recordPage.locator('#clickToResetAttributes').click()
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'attributes-reset').length === 1)
		const attributeResetSpans = recordPage.receivedSpans.filter((span) => span.name === 'attributes-reset')

		expect(attributeResetSpans).toHaveLength(1)

		expect(attributeResetSpans[0].tags['environment']).toBe(undefined)
		expect(attributeResetSpans[0].tags['key1']).toBe(undefined)
		expect(attributeResetSpans[0].tags['key1']).toBe(undefined)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('instrumentations.errors controls error capture', async ({ recordPage }) => {
		await recordPage.goTo('/init/capture-errors.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'error-guard-span').length === 1)
		const guardSpans = recordPage.receivedSpans.filter((span) => span.name === 'error-guard-span')

		expect(guardSpans).toHaveLength(1)

		expect(recordPage.receivedErrorSpans).toHaveLength(0)
	})

	test('environment % resource attrs still get set if no global attributes', async ({ recordPage }) => {
		await recordPage.goTo('/init/attributes-no-globals.ejs')
		await recordPage.waitForSpans((spans) => spans.filter((span) => span.name === 'documentLoad').length === 1)

		const documentLoadSpans = recordPage.receivedSpans.filter((span) => span.name === 'documentLoad')
		expect(documentLoadSpans).toHaveLength(1)

		expect(documentLoadSpans[0].tags['app']).toBe('custom-app')
		expect(documentLoadSpans[0].tags['environment']).toBe('custom-environment')

		// Set as a resource, zipkin exporter should merge into tags
		expect(documentLoadSpans[0].tags['telemetry.sdk.name']).toBe('@splunk/otel-web')
		expect(documentLoadSpans[0].tags['telemetry.sdk.language']).toBe('webjs')
		expect(documentLoadSpans[0].tags['telemetry.sdk.version']).toBe(VERSION)
		expect(documentLoadSpans[0].tags['splunk.rumVersion']).toBe(VERSION)
	})
})
