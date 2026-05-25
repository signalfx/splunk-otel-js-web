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

import * as tracing from '@opentelemetry/sdk-trace-base'
import { afterEach, describe, expect, it } from 'vitest'

import SplunkRum from '../src/index'
import { deinit, getTracer, initWithDefaultConfig, SpanCapturer } from './utils'

const createSpan = (tracer: ReturnType<typeof getTracer>) => {
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

	it('cookies/userTrackingMode is default, then noTracking', () => {
		initWithDefaultConfig(capturer)

		const tracer = getTracer('test')

		const spanWithAnonymousId = createSpan(tracer)
		expect(spanWithAnonymousId).toHaveSpanAttribute('user.anonymous_id')
		expect(getCookie(), 'Checking cookie value').equal(spanWithAnonymousId.attributes['user.anonymous_id'])

		SplunkRum.setUserTrackingMode('noTracking')

		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId).toNotHaveSpanAttribute('user.anonymous_id')
	})

	it('cookies/userTrackingMode is anonymousTracking, then noTracking', () => {
		initWithDefaultConfig(capturer, { user: { trackingMode: 'anonymousTracking' } })

		const tracer = getTracer('test')

		const spanWithAnonymousId = createSpan(tracer)
		expect(spanWithAnonymousId).toHaveSpanAttribute('user.anonymous_id')
		expect(getCookie(), 'Checking cookie value').equal(spanWithAnonymousId.attributes['user.anonymous_id'])

		SplunkRum.setUserTrackingMode('noTracking')

		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId).toNotHaveSpanAttribute('user.anonymous_id')
	})

	it('localStorage/userTrackingMode is anonymousTracking, then noTracking', () => {
		initWithDefaultConfig(capturer, { persistence: 'localStorage', user: { trackingMode: 'anonymousTracking' } })

		const tracer = getTracer('test')

		const spanWithAnonymousId = createSpan(tracer)
		expect(spanWithAnonymousId).toHaveSpanAttribute('user.anonymous_id')
		expect(getLocalStorage(), 'Checking localStorage value').toBe(
			spanWithAnonymousId.attributes['user.anonymous_id'],
		)

		SplunkRum.setUserTrackingMode('noTracking')

		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId).toNotHaveSpanAttribute('user.anonymous_id')
	})

	it('localStorage/userTrackingMode is default, then noTracking', () => {
		initWithDefaultConfig(capturer, { persistence: 'localStorage' })

		const tracer = getTracer('test')

		const spanWithAnonymousId = createSpan(tracer)
		expect(spanWithAnonymousId).toHaveSpanAttribute('user.anonymous_id')
		expect(getLocalStorage(), 'Checking localStorage value').toBe(
			spanWithAnonymousId.attributes['user.anonymous_id'],
		)

		SplunkRum.setUserTrackingMode('noTracking')

		const spanWithoutAnonymousId = createSpan(tracer)
		expect(spanWithoutAnonymousId).toNotHaveSpanAttribute('user.anonymous_id')
	})
})
