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

import * as assert from 'assert'
import SplunkRum from '../src/index'
import * as tracing from '@opentelemetry/sdk-trace-base'
import { deinit, initWithDefaultConfig, SpanCapturer } from './utils'

const createSpan = (tracer: tracing.Tracer) => {
	const span = tracer.startSpan('testSpan')
	span.end()
	return span as tracing.Span
}

const checkLocalStorage = (expectedValue: string) => {
	const lsValue = localStorage.getItem('splunk.anonymousId')
	assert.equal(lsValue, expectedValue, 'Checking localStorage value')
}

const checkCookie = (expectedValue: string) => {
	const cookieValue = document.cookie
		.split('; ')
		.find((row) => row.startsWith('splunk.anonymousId='))
		?.split('=')[1]
	assert.equal(cookieValue, expectedValue, 'Checking cookie value')
}

describe('userTracking is reflected', () => {
	const capturer = new SpanCapturer()

	afterEach(() => {
		deinit(true)
	})

	it('localStorage/userTracking is true, then false', () => {
		initWithDefaultConfig(capturer, { userTracking: true, persistence: 'localStorage' })

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymousId']
		assert.ok(anonymousId, 'Checking user.anonymousId')
		checkLocalStorage(anonymousId as string)

		SplunkRum.setUserTracking(false)

		const spanWithoutAnonymousId = createSpan(tracer)
		assert.equal(spanWithoutAnonymousId.attributes['user.anonymousId'], undefined, 'Checking user.anonymousId')
	})

	it('localStorage/userTracking is false, then true', () => {
		initWithDefaultConfig(capturer, { persistence: 'localStorage' })

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithoutAnonymousId = createSpan(tracer)
		assert.equal(spanWithoutAnonymousId.attributes['user.anonymousId'], undefined, 'Checking user.anonymousId')

		SplunkRum.setUserTracking(true)

		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymousId']
		assert.ok(anonymousId, 'Checking user.anonymousId')
		checkLocalStorage(anonymousId as string)
	})

	it('cookies/userTracking is true, then false', () => {
		initWithDefaultConfig(capturer, { userTracking: true })

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymousId']
		assert.ok(anonymousId, 'Checking user.anonymousId')
		checkCookie(anonymousId as string)

		SplunkRum.setUserTracking(false)

		const spanWithoutAnonymousId = createSpan(tracer)
		assert.equal(spanWithoutAnonymousId.attributes['user.anonymousId'], undefined, 'Checking user.anonymousId')
	})

	it('cookies/userTracking is false, then true', () => {
		initWithDefaultConfig(capturer)

		const tracer = SplunkRum.provider.getTracer('test')
		const spanWithoutAnonymousId = createSpan(tracer)
		assert.equal(spanWithoutAnonymousId.attributes['user.anonymousId'], undefined, 'Checking user.anonymousId')

		SplunkRum.setUserTracking(true)

		const spanWithAnonymousId = createSpan(tracer)
		const anonymousId = spanWithAnonymousId.attributes['user.anonymousId']
		assert.ok(anonymousId, 'Checking user.anonymousId')
		checkCookie(anonymousId as string)
	})
})
