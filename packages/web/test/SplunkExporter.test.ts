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

import sinon from 'sinon'
import { expect } from 'chai'

import * as api from '@opentelemetry/api'
import { timeInputToHrTime } from '@opentelemetry/core'
import { SplunkZipkinExporter } from '../src/exporters/zipkin'
import { RateLimitProcessor } from '../src/exporters/rate-limit'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

function buildDummySpan({ name = '<name>', attributes = {} } = {}) {
	return {
		spanContext: () => ({
			traceId: '0000',
			spanId: '0001',
		}),
		parentSpanId: '0002' as string | undefined,
		name,
		attributes,
		kind: api.SpanKind.CLIENT,
		startTime: timeInputToHrTime(new Date()),
		duration: timeInputToHrTime(1000),
		status: { code: api.SpanStatusCode.UNSET },
		resource: { attributes: {} },
		events: [] as { name: string; time: api.HrTime }[],
	} as ReadableSpan
}

describe('SplunkZipkinExporter', () => {
	let beaconSenderMock
	let xhrSenderMock
	let exporter

	beforeEach(() => {
		beaconSenderMock = sinon.stub(navigator, 'sendBeacon').returns(true)
		xhrSenderMock = sinon.fake()
	})

	afterEach(() => {
		exporter.shutdown()
		beaconSenderMock.restore()
	})

	it('uses Beacon API if in background', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://domain1',
			xhrSender: xhrSenderMock,
		})

		const targetDocProto = Object.getPrototypeOf(Object.getPrototypeOf(document))
		const oldDef = Object.getOwnPropertyDescriptor(targetDocProto, 'hidden')
		Object.defineProperty(targetDocProto, 'hidden', {
			get() {
				return true
			},
			configurable: true,
			enumerable: true,
		})
		const dummySpan = buildDummySpan()
		exporter.export([dummySpan], () => {})

		Object.defineProperty(targetDocProto, 'hidden', oldDef)

		expect(beaconSenderMock.args[0][0]).to.eq('https://domain1')
		const sentSpan = JSON.parse(beaconSenderMock.args[0][1])[0]
		expect(sentSpan.name).to.equal('<name>')
		expect(sentSpan.id).to.equal('0001')

		expect(xhrSenderMock.called).to.eq(false)
	})

	it('uses XHR if Beacon API is unavailable', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://domain2',
			beaconSender: null,
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan()
		exporter.export([dummySpan], () => {})

		expect(xhrSenderMock.args[0][0]).to.eq('https://domain2')

		const sentSpan = JSON.parse(xhrSenderMock.args[0][1])[0]
		expect(sentSpan.name).to.equal('<name>')
		expect(sentSpan.id).to.equal('0001')
	})

	it('truncates long values', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan({
			name: 'a'.repeat(5000),
			attributes: {
				longValue: 'b'.repeat(5001),
				shortValue: 'c'.repeat(4000),
			},
		})
		exporter.export([dummySpan], () => {})

		const sentSpan = JSON.parse(xhrSenderMock.getCall(0).args[1])[0]
		expect(sentSpan.name).to.eq('a'.repeat(4096))
		expect(sentSpan.tags['longValue']).to.eq('b'.repeat(4096))
		expect(sentSpan.tags['shortValue']).to.eq('c'.repeat(4000))
	})

	it('filters out missing cors timings', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
		})

		const dummySpan = buildDummySpan({
			name: 'asd',
			attributes: {
				'http.url': 'https://example.com/resource.png',
			},
		})
		dummySpan.events.push({
			time: dummySpan.startTime,
			name: 'fetchStart',
		})
		dummySpan.events.push({
			time: timeInputToHrTime(0),
			name: 'connectStart',
		})
		dummySpan.events.push({
			time: timeInputToHrTime(0),
			name: 'connectEnd',
		})
		dummySpan.events.push({
			time: dummySpan.startTime,
			name: 'responseEnd',
		})
		exporter.export([dummySpan], () => {})

		const sentSpan = JSON.parse(xhrSenderMock.getCall(0).args[1])[0]
		expect(sentSpan.annotations.length).to.eq(2)
	})

	it('allows hooking into serialization', () => {
		exporter = new SplunkZipkinExporter({
			url: 'https://localhost',
			xhrSender: xhrSenderMock,
			onAttributesSerializing: (attributes) => ({
				...attributes,
				key1: 'new value 1',
				key3: null,
			}),
		})

		const dummySpan = buildDummySpan({
			attributes: {
				key1: 'value 1',
				key2: 'value 2',
				key3: 'value 3',
			},
		})
		exporter.export([dummySpan], () => {})

		const sentSpan = JSON.parse(xhrSenderMock.getCall(0).args[1])[0]
		expect(sentSpan.name).to.eq('<name>')
		console.log(sentSpan.tags)
		expect(sentSpan.tags).to.deep.eq({
			key1: 'new value 1',
			key2: 'value 2',
			key3: 'null',
		})
	})
})

describe('Rate Limiter', () => {
	it('limits spans sent', () => {
		const allowedSpans: ReadableSpan[] = []
		const rateLimiter = new RateLimitProcessor({
			onStart() {},
			onEnd(span) {
				allowedSpans.push(span)
			},
			forceFlush() {
				return Promise.resolve()
			},
			shutdown() {
				return Promise.resolve()
			},
		})

		const dummySpan = buildDummySpan()
		for (let i = 0; i < 110; i++) {
			rateLimiter.onEnd(dummySpan)
		}

		expect(allowedSpans).to.have.lengthOf(100)
	})

	it('still exports parent spans', () => {
		const allowedSpans: ReadableSpan[] = []
		const rateLimiter = new RateLimitProcessor({
			onStart() {},
			onEnd(span) {
				allowedSpans.push(span)
			},
			forceFlush() {
				return Promise.resolve()
			},
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
			traceId: '0000',
			spanId: '0002',
		})
		// @ts-expect-error read-only
		parentSpan.parentSpanId = undefined
		rateLimiter.onEnd(parentSpan)

		expect(allowedSpans).to.have.lengthOf(101)
	})
})
