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

import type { Span } from '@opentelemetry/api'
import { describe, expect, it, vi } from 'vitest'

import { NavigationVisibilityRecorder } from './navigation-visibility-recorder'

const HIDDEN_RANGES_ATTRIBUTE = 'browser.navigation.hidden_ranges'

function getHiddenRanges(attributes: Record<string, unknown>): Array<{ end_ms: number; start_ms: number }> {
	return JSON.parse(attributes[HIDDEN_RANGES_ATTRIBUTE] as string) as Array<{ end_ms: number; start_ms: number }>
}

function createSpan() {
	const attributes: Record<string, unknown> = {}
	const span = {
		setAttribute: vi.fn((name: string, value: unknown) => (attributes[name] = value)),
	}
	return { attributes, span: span as unknown as Span }
}

describe('NavigationVisibilityRecorder', () => {
	it('shares initial navigation ranges between documentLoad and pageLoad until pageLoad ends', () => {
		const recorder = new NavigationVisibilityRecorder()
		const { attributes: documentLoadAttributes, span: documentLoadSpan } = createSpan()
		const { attributes: pageLoadAttributes, span: pageLoadSpan } = createSpan()
		const sharedCaptureKey = 'initial-document-navigation'

		recorder.startCapture(documentLoadSpan, sharedCaptureKey, 10, false)
		recorder.startCapture(pageLoadSpan, sharedCaptureKey, 10, false)
		recorder.recordVisibilityChange(12, true)
		recorder.recordVisibilityChange(15, false)

		recorder.endCapture(documentLoadSpan, 20)
		expect(getHiddenRanges(documentLoadAttributes)).toEqual([{ end_ms: 5, start_ms: 2 }])

		recorder.recordVisibilityChange(22, true)
		recorder.recordVisibilityChange(24, false)
		recorder.endCapture(pageLoadSpan, 25)

		expect(getHiddenRanges(pageLoadAttributes)).toEqual([
			{ end_ms: 5, start_ms: 2 },
			{ end_ms: 14, start_ms: 12 },
		])
	})

	it('records a docLoad range when no pageLoad capture exists', () => {
		const recorder = new NavigationVisibilityRecorder()
		const { attributes, span: documentLoadSpan } = createSpan()

		recorder.startCapture(documentLoadSpan, 'initial-document-navigation', 10, true)
		recorder.recordVisibilityChange(15, false)
		recorder.endCapture(documentLoadSpan, 20)

		expect(getHiddenRanges(attributes)).toEqual([{ end_ms: 5, start_ms: 0 }])
	})

	it('clips a route change range to the route span boundaries', () => {
		const recorder = new NavigationVisibilityRecorder()
		const { attributes, span: routeChangeSpan } = createSpan()

		recorder.startCapture(routeChangeSpan, routeChangeSpan, 20, true)
		recorder.recordVisibilityChange(23, false)
		recorder.endCapture(routeChangeSpan, 25)

		expect(getHiddenRanges(attributes)).toEqual([{ end_ms: 3, start_ms: 0 }])
	})
})
