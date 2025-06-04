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

import SplunkRum from '../src/index'
import * as tracing from '@opentelemetry/sdk-trace-base'
import { describe, it, expect, afterEach } from 'vitest'
import { deinit, initWithDefaultConfig, SpanCapturer } from './utils'

const createSpan = (tracer: tracing.Tracer) => {
	const span = tracer.startSpan('testSpan')
	span.end()
	return span as tracing.Span
}

const getLocalStorage = () => localStorage.getItem('_splunk_rum_user_anonymousId')

const getCookie = () =>
	document.cookie
		.split('; ')
		.find((row) => row.startsWith('_splunk_rum_user_anonymousId='))
		?.split('=')[1]

describe('userTracking is reflected', () => {
	const capturer = new SpanCapturer()

	afterEach(() => {
		deinit(true)
	})

	it('cookies/userTrackingMode is default, then anonymousTracking', () => {
		initWithDefaultConfig(capturer)

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId.attributes['user.anonymous_id'], 'Checking user.anonymous_id').toBeUndefined()

		SplunkRum.setUserTrackingMode('anonymousTracking')

		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymous_id']
		expect(anonymousId, 'Checking user.anonymous_id').toBeDefined()
		expect(getCookie(), 'Checking cookie value').equal(anonymousId)
	})

	it('cookies/userTrackingMode is anonymousTracking, then noTracking', () => {
		initWithDefaultConfig(capturer, { user: { trackingMode: 'anonymousTracking' } })

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymous_id']
		expect(anonymousId, 'Checking user.anonymous_id').toBeDefined()
		expect(getCookie(), 'Checking cookie value').equal(anonymousId)

		SplunkRum.setUserTrackingMode('noTracking')

		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId.attributes['user.anonymous_id'], 'Checking user.anonymous_id').toBeUndefined()
	})

	it('localStorage/userTrackingMode is anonymousTracking, then noTracking', () => {
		initWithDefaultConfig(capturer, { user: { trackingMode: 'anonymousTracking' }, persistence: 'localStorage' })

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymous_id']
		expect(anonymousId, 'Checking user.anonymous_id').toBe(getLocalStorage())

		SplunkRum.setUserTrackingMode('noTracking')

		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId.attributes['user.anonymous_id'], 'Checking user.anonymous_id').toBeUndefined()
	})

	it('localStorage/userTrackingMode is default, then anonymousTracking', () => {
		initWithDefaultConfig(capturer, { persistence: 'localStorage' })

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId.attributes['user.anonymous_id'], 'Checking user.anonymous_id').toBeUndefined()

		SplunkRum.setUserTrackingMode('anonymousTracking')

		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymous_id']
		expect(anonymousId, 'Checking user.anonymous_id').toBe(getLocalStorage())
	})
})
