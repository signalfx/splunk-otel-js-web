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

import type { Span } from '@opentelemetry/sdk-trace-base'
import { describe, expect, it } from 'vitest'

import { createSpanMock } from '../../tests/utils/span-mock'
import { SpaMetricsManager } from '../managers'
import { BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE } from '../managers/spa-metrics-manager/constants'
import { PctRelevantSpanProcessor } from './pct-relevant-span-processor'

function createReadableSpanMock({ component, name = 'HTTP GET' }: { component?: string; name?: string }): {
	attributes: Record<string, number | string>
	span: Span
} {
	const attributes: Record<string, number | string> = {}
	if (component) {
		attributes.component = component
	}

	const span = {
		attributes,
		end: () => {},
		name,
		setAttribute: (attributeName: string, value: number | string) => {
			attributes[attributeName] = value
			return span
		},
	} as Span

	return { attributes, span }
}

describe('PctRelevantSpanProcessor', () => {
	it('marks relevant spans with the current navigation span id', () => {
		const manager = new SpaMetricsManager()
		const processor = new PctRelevantSpanProcessor(manager)
		const { span: navigationSpan } = createSpanMock('navigation-span-id')
		const { attributes, span } = createReadableSpanMock({ component: 'fetch' })
		manager.setCurrentNavigationSpan(navigationSpan)

		processor.onStart(span)
		span.end()

		expect(attributes[BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE]).toBe('navigation-span-id')
	})

	it('marks document-load resource spans by component and span name', () => {
		const manager = new SpaMetricsManager()
		const processor = new PctRelevantSpanProcessor(manager)
		const { span: navigationSpan } = createSpanMock('navigation-span-id')
		const { attributes, span } = createReadableSpanMock({
			component: 'document-load',
			name: 'resourceFetch',
		})
		manager.setCurrentNavigationSpan(navigationSpan)

		processor.onStart(span)
		span.end()

		expect(attributes[BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE]).toBe('navigation-span-id')
	})

	it('does not mark unrelated spans', () => {
		const manager = new SpaMetricsManager()
		const processor = new PctRelevantSpanProcessor(manager)
		const { span: navigationSpan } = createSpanMock('navigation-span-id')
		const { attributes, span } = createReadableSpanMock({ component: 'error' })
		manager.setCurrentNavigationSpan(navigationSpan)

		processor.onStart(span)
		span.end()

		expect(attributes[BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE]).toBeUndefined()
	})

	it('does not mark relevant spans when no navigation is active', () => {
		const manager = new SpaMetricsManager()
		const processor = new PctRelevantSpanProcessor(manager)
		const { attributes, span } = createReadableSpanMock({ component: 'splunk-loaf' })

		processor.onStart(span)
		span.end()

		expect(attributes[BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE]).toBeUndefined()
	})

	it('does not mark spans ending after navigation is no longer active', () => {
		const manager = new SpaMetricsManager()
		const processor = new PctRelevantSpanProcessor(manager)
		const { span: navigationSpan } = createSpanMock('navigation-span-id')
		const { attributes, span } = createReadableSpanMock({ component: 'fetch' })
		manager.setCurrentNavigationSpan(navigationSpan)

		processor.onStart(span)
		manager.clearCurrentNavigationSpan(navigationSpan)
		span.end()

		expect(attributes[BROWSER_NAVIGATION_RELEVANT_ID_ATTRIBUTE]).toBeUndefined()
	})
})
