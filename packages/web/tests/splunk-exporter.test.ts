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

import * as api from '@opentelemetry/api'
import { timeInputToHrTime } from '@opentelemetry/core'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { afterEach, assert, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { RateLimitProcessor } from '../src/exporters/rate-limit'
import { SplunkZipkinExporter } from '../src/exporters/zipkin'

const buildDummySpan = ({ attributes = {}, name = '<name>' } = {}) =>
	({
		attributes: {
			...attributes,
			'splunk.rumSessionId': '000000000',
		},
		duration: timeInputToHrTime(1000),
		events: [] as { name: string; time: api.HrTime }[],
		kind: api.SpanKind.CLIENT,
		name,
		parentSpanId: '0002' as string | undefined,
		resource: { attributes: {} },
		spanContext: () => ({
			spanId: '0001',
			traceId: '0000',
		}),
		startTime: timeInputToHrTime(new Date()),
		status: { code: api.SpanStatusCode.UNSET },
	}) as unknown as ReadableSpan

describe('SplunkZipkinExporter', () => {
	let beaconSenderMock: Mock
	const originalBeacon = window.navigator.sendBeacon
	let xhrSenderMock: Mock
	let exporter: SplunkZipkinExporter

	beforeEach(() => {
		beaconSenderMock = vi.fn().mockReturnValue(true)
		window.navigator.sendBeacon = beaconSenderMock

		// eslint-disable-next-line unicorn/no-useless-undefined
		xhrSenderMock = vi.fn().mockReturnValue(undefined)
	})

	afterEach(async () => {
		await exporter.shutdown()
		window.navigator.sendBeacon = originalBeacon
	})

	it('uses Beacon API if in background', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://domain1',
			xhrSender: xhrSenderMock,
		})

		const targetDocProto = Object.getPrototypeOf(Object.getPrototypeOf(document))
		const oldDef = Object.getOwnPropertyDescriptor(targetDocProto, 'hidden')
		Object.defineProperty(targetDocProto, 'hidden', {
			configurable: true,
			enumerable: true,
			get() {
				return true
			},
		})

		const dummySpan = buildDummySpan()
		exporter.export([dummySpan], () => {})

		assert(oldDef)
		Object.defineProperty(targetDocProto, 'hidden', oldDef)

		expect(beaconSenderMock).toHaveBeenCalledTimes(1)
		const sendBeaconArgs = beaconSenderMock.mock.calls[0]
		expect(sendBeaconArgs[0]).toBe('https://domain1')

		const sentSpan = JSON.parse(sendBeaconArgs[1])[0]

		expect(sentSpan.name).toBe('<name>')
		expect(sentSpan.id).toBe('0001')

		expect(xhrSenderMock).toHaveBeenCalledTimes(0)
	})

	it('uses XHR if Beacon API is unavailable', () => {
		exporter = new SplunkZipkinExporter({
			beaconSender: undefined,
			url: 'https://domain2',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan()
		exporter.export([dummySpan], () => {})

		expect(xhrSenderMock).toHaveBeenCalledTimes(1)
		const sendXhrArgs = xhrSenderMock.mock.calls[0]

		expect(sendXhrArgs[0]).toBe('https://domain2')

		const sentSpan = JSON.parse(sendXhrArgs[1])[0]
		expect(sentSpan.name).toBe('<name>')
		expect(sentSpan.id).toBe('0001')
	})

	it('truncates long values', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan({
			attributes: {
				longValue: 'b'.repeat(5001),
				shortValue: 'c'.repeat(4000),
			},
			name: 'a'.repeat(5000),
		})
		exporter.export([dummySpan], () => {})
		expect(xhrSenderMock).toHaveBeenCalledTimes(1)
		const sendXhrArgs = xhrSenderMock.mock.calls[0]
		const sentSpan = JSON.parse(sendXhrArgs[1])[0]
		expect(sentSpan.name).toBe('a'.repeat(4096))
		expect(sentSpan.tags['longValue']).toBe('b'.repeat(4096))
		expect(sentSpan.tags['shortValue']).toBe('c'.repeat(4000))
	})

	it('filters out missing cors timings', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan({
			attributes: {
				'http.url': 'https://example.com/resource.png',
			},
			name: 'asd',
		})
		dummySpan.events.push(
			{
				name: 'fetchStart',
				time: dummySpan.startTime,
			},
			{
				name: 'connectStart',
				time: timeInputToHrTime(0),
			},
			{
				name: 'connectEnd',
				time: timeInputToHrTime(0),
			},
			{
				name: 'responseEnd',
				time: dummySpan.startTime,
			},
		)
		exporter.export([dummySpan], () => {})
		expect(xhrSenderMock).toHaveBeenCalledTimes(1)
		const sendXhrArgs = xhrSenderMock.mock.calls[0]
		const sentSpan = JSON.parse(sendXhrArgs[1])[0]
		expect(sentSpan.annotations).toHaveLength(2)
	})

	it('filters out not set service.name', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan({
			attributes: {
				'http.url': 'https://example.com/resource.png',
			},
			name: 'asd',
		})

		exporter.export([dummySpan], () => {})
		expect(xhrSenderMock).toHaveBeenCalledTimes(1)
		const sendXhrArgs = xhrSenderMock.mock.calls[0]
		const sentSpan = JSON.parse(sendXhrArgs[1])[0]

		expect(sentSpan.tags['service.name']).toBeUndefined()
	})

	it('preserves set service.name', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan({
			attributes: {
				'http.url': 'https://example.com/resource.png',
				'service.name': 'my-service',
			},
			name: 'asd',
		})

		exporter.export([dummySpan], () => {})
		expect(xhrSenderMock).toHaveBeenCalledTimes(1)
		const sendXhrArgs = xhrSenderMock.mock.calls[0]
		const sentSpan = JSON.parse(sendXhrArgs[1])[0]

		expect(sentSpan.tags['service.name']).toBe('my-service')
	})

	it('allows hooking into serialization', () => {
		exporter = new SplunkZipkinExporter({
			onAttributesSerializing: (attributes) => ({
				...attributes,
				key1: 'new value 1',
				key3: null,
			}),
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan({
			attributes: {
				key1: 'value 1',
				key2: 'value 2',
				key3: 'value 3',
			},
		})
		exporter.export([dummySpan], () => {})
		expect(xhrSenderMock).toHaveBeenCalledTimes(1)
		const sendXhrArgs = xhrSenderMock.mock.calls[0]

		const sentSpan = JSON.parse(sendXhrArgs[1])[0]
		expect(sentSpan.name).toBe('<name>')
		expect(sentSpan.tags).toStrictEqual({
			'key1': 'new value 1',
			'key2': 'value 2',
			'key3': 'null',
			'splunk.rumSessionId': '000000000',
		})
	})
})

describe('Rate Limiter', () => {
	it('limits spans sent', () => {
		const allowedSpans: ReadableSpan[] = []
		const rateLimiter = new RateLimitProcessor({
			forceFlush() {
				return Promise.resolve()
			},
			onEnd(span) {
				allowedSpans.push(span)
			},
			onStart() {},
			shutdown() {
				return Promise.resolve()
			},
		})

		const dummySpan = buildDummySpan()
		for (let i = 0; i < 110; i++) {
			rateLimiter.onEnd(dummySpan)
		}

		expect(allowedSpans).toHaveLength(100)
	})

	it('still exports parent spans', () => {
		const allowedSpans: ReadableSpan[] = []
		const rateLimiter = new RateLimitProcessor({
			forceFlush() {
				return Promise.resolve()
			},
			onEnd(span) {
				allowedSpans.push(span)
			},
			onStart() {},
			shutdown() {
				return Promise.resolve()
			},
		})

		const dummySpan = buildDummySpan()
		for (let i = 0; i < 110; i++) {
			rateLimiter.onEnd(dummySpan)
		}
		const parentSpan = buildDummySpan()
		// @ts-expect-error read-only
		parentSpan.spanContext = () => ({
			spanId: '0002',
			traceId: '0000',
		})
		// @ts-expect-error read-only
		parentSpan.parentSpanId = undefined
		rateLimiter.onEnd(parentSpan)

		expect(allowedSpans).toHaveLength(101)
	})
})
