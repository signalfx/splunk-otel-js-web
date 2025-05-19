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

import SplunkRum from '../src'
import * as tracing from '@opentelemetry/sdk-trace-base'
import { deinit, initWithDefaultConfig, SpanCapturer } from './utils'
import { VERSION } from '../src/version'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { context, trace } from '@opentelemetry/api'

const doesBeaconUrlEndWith = (suffix: string) => {
	const sps = (SplunkRum.provider.getActiveSpanProcessor() as any)._spanProcessors
	// TODO: refactor to make beaconUrl field private
	const beaconUrl = sps[1]._exporter.beaconUrl || sps[1]._exporter.url
	expect(beaconUrl.endsWith(suffix), `Checking beaconUrl if (${beaconUrl}) ends with ${suffix}`).toBeTruthy()
}

describe('test init', () => {
	let capturer: SpanCapturer

	afterEach(() => {
		SplunkRum.deinit(true)

		expect(SplunkRum.inited).toBeFalsy()
		expect(!window[Symbol.for('opentelemetry.js.api.1')]['splunk.rum'])
		expect(!window[Symbol.for('opentelemetry.js.api.1')]['splunk.rum.version'])
		expect(!window[Symbol.for('opentelemetry.js.api.1')]['diag'])

		window[Symbol.for('opentelemetry.js.api.1')] = undefined

		deinit()
	})

	beforeEach(() => {
		expect(SplunkRum.inited).toBeFalsy()

		capturer = new SpanCapturer()
	})

	describe('not specifying beaconUrl', () => {
		it('should not be inited', () => {
			try {
				SplunkRum.init({
					beaconEndpoint: undefined,
					applicationName: 'app',
					rumAccessToken: undefined,
				})
				expect(false, 'Initializer finished.').toBeTruthy()
			} catch {
				expect(SplunkRum.inited === false, 'SplunkRum should not be inited.').toBeTruthy()
			}
		})
	})

	describe('should enforce secure beacon url', () => {
		it('should not be inited with http', () => {
			try {
				SplunkRum.init({
					beaconEndpoint: 'http://127.0.0.1:8888/insecure',
					applicationName: 'app',
					rumAccessToken: undefined,
				})
				expect(false, 'Initializer finished.').toBeTruthy()
			} catch {
				expect(SplunkRum.inited === false, 'SplunkRum should not be inited.').toBeTruthy()
			}
		})

		it('should init with https', () => {
			const path = '/secure'
			SplunkRum.init({
				beaconEndpoint: `https://127.0.0.1:8888/${path}`,
				applicationName: 'app',
				rumAccessToken: undefined,
			})
			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith(path)
		})

		it('can be forced via allowInsecureBeacon option', () => {
			const path = '/insecure'
			SplunkRum.init({
				beaconEndpoint: `http://127.0.0.1:8888/${path}`,
				allowInsecureBeacon: true,
				applicationName: 'app',
				rumAccessToken: undefined,
			})

			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith(path)
		})

		it('can use realm config option', () => {
			SplunkRum.init({ realm: 'test', applicationName: 'app', rumAccessToken: undefined })

			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith('https://rum-ingest.test.signalfx.com/v1/rum')
		})

		it('can use realm + otlp config option', () => {
			SplunkRum.init({
				realm: 'test',
				applicationName: 'app',
				rumAccessToken: undefined,
				exporter: {
					otlp: true,
				},
			})
			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith('https://rum-ingest.test.signalfx.com/v1/rumotlp')
		})
	})

	describe('successful', () => {
		it('should have been inited properly with doc load spans', async () => {
			SplunkRum.init({
				beaconEndpoint: 'https://127.0.0.1:9999/foo',
				applicationName: 'my-app',
				deploymentEnvironment: 'my-env',
				globalAttributes: { customerType: 'GOLD' },
				instrumentations: {
					websocket: true,
				},
				rumAccessToken: undefined,
				spanProcessors: [capturer],
			})

			expect(SplunkRum.inited).toBeTruthy()

			await new Promise<void>((resolve) => {
				setTimeout(() => {
					resolve()
				}, 1000)
			})

			expect(capturer.spans.length >= 3).toBeTruthy()
			const docLoadTraceId = capturer.spans.find((span) => span.name === 'documentLoad')?.spanContext().traceId

			capturer.spans
				.filter((span) => span.attributes['component'] === 'document-load')
				.forEach((span) => {
					expect(span.spanContext().traceId).toBe(docLoadTraceId)
				})

			const documentFetchSpan = capturer.spans.find((span) => span.name === 'documentFetch')
			expect(documentFetchSpan, 'documentFetch span presence.').toBeTruthy()

			// TODO: Find a way to replace karma.customHeaders in vitest
			// if (!navigator.userAgent.includes('Firefox')) {
			// 	expect(documentFetchSpan.attributes['link.spanId']).toBe('0000000000000002')
			// }

			const documentLoadSpan = capturer.spans.find((span) => span.name === 'documentLoad')
			expect(documentLoadSpan, 'documentLoad span presence.').toBeTruthy()
			expect(/^[0-9]+x[0-9]+$/.test(documentLoadSpan.attributes['screen.xy'] as string)).toBeTruthy()

			const resourceFetchSpan = capturer.spans.find((span) => span.name === 'resourceFetch')
			expect(resourceFetchSpan, 'resourceFetch span presence.').toBeTruthy()
		})

		it('is backwards compatible with 0.15.3 and earlier config options', () => {
			SplunkRum.init({
				beaconUrl: 'https://127.0.0.1:9999/foo',
				app: 'my-app',
				environment: 'my-env',
				rumAuth: 'test123',
			})

			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith('/foo?auth=test123')
		})
	})

	describe('double-init has no effect', () => {
		it('should have been inited only once', () => {
			SplunkRum.init({
				beaconEndpoint: 'https://127.0.0.1:8888/foo',
				applicationName: 'app',
				rumAccessToken: undefined,
			})
			SplunkRum.init({
				beaconEndpoint: 'https://127.0.0.1:8888/bar',
				applicationName: 'app',
				rumAccessToken: undefined,
			})
			doesBeaconUrlEndWith('/foo')
		})
	})

	describe('exporter option', () => {
		it('allows setting factory', async () => {
			const exportMock = vi.fn().mockReturnValue(undefined)
			const onAttributesSerializingMock = vi.fn().mockReturnValue(undefined)

			SplunkRum._internalInit({
				beaconEndpoint: 'https://domain1',
				allowInsecureBeacon: true,
				applicationName: 'my-app',
				deploymentEnvironment: 'my-env',
				globalAttributes: { customerType: 'GOLD' },
				bufferTimeout: 0,
				exporter: {
					onAttributesSerializing: onAttributesSerializingMock,
					factory: (options) => {
						expect(options.onAttributesSerializing).toBe(onAttributesSerializingMock)
						return {
							export: exportMock,
							shutdown: () => Promise.resolve(),
						}
					},
				},
				rumAccessToken: '123-no-warn-spam-in-console',
			})
			SplunkRum.provider.getTracer('test').startSpan('testSpan').end()

			await expect.poll(() => exportMock.mock.calls.length > 0).toBeTruthy()
		})
	})

	describe('multiple instance protection', () => {
		function init() {
			SplunkRum.init({
				beaconEndpoint: 'https://127.0.0.1:9999/foo',
				applicationName: 'my-app',
				deploymentEnvironment: 'my-env',
				globalAttributes: { customerType: 'GOLD' },
				instrumentations: {
					websocket: true,
				},
				rumAccessToken: undefined,
			})
		}

		it('sets the global version flag', () => {
			init()
			expect(SplunkRum.inited).toBeTruthy()

			const globalApi = window[Symbol.for('opentelemetry.js.api.1')]

			expect(typeof globalApi['splunk.rum.version'] === 'string').toBeTruthy()
			expect(typeof globalApi['splunk.rum'] === 'object').toBeTruthy()
			expect(globalApi['splunk.rum']).toBeTruthy()
		})

		it('fails the init if the version does not match', () => {
			window[Symbol.for('opentelemetry.js.api.1')] = {}
			window[Symbol.for('opentelemetry.js.api.1')]['splunk.rum.version'] = '1.2.3'
			init()
			expect(SplunkRum.inited).toBeFalsy()
		})

		it('fails the init if splunk.rum already exists', () => {
			window[Symbol.for('opentelemetry.js.api.1')] = {}
			window[Symbol.for('opentelemetry.js.api.1')]['splunk.rum.version'] = VERSION
			window[Symbol.for('opentelemetry.js.api.1')]['splunk.rum'] = {}
			init()
			expect(SplunkRum.inited).toBeFalsy()
		})
	})
})

describe('creating spans is possible', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		const testName = expect.getState().currentTestName
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, testName)
	})

	afterEach(() => {
		deinit(true)
	})

	// FIXME figure out ways to validate zipkin 'export', sendBeacon, etc. etc.
	it('should have extra fields added', () => {
		const tracer = SplunkRum.provider.getTracer('test')

		const span = tracer.startSpan('testSpan')

		context.with(trace.setSpan(context.active(), span), () => {
			expect(trace.getSpan(context.active())).toStrictEqual(span)
		})
		span.end()

		const exposedSpan = span as tracing.Span
		expect(exposedSpan.attributes['location.href'], 'Checking location.href').toBeTruthy()
		expect(exposedSpan.attributes['environment']).toBe('my-env')
		expect(exposedSpan.attributes['app.version']).toBe('1.2-test.3')
		expect(exposedSpan.attributes.customerType).toBe('GOLD')
		expect(exposedSpan.attributes['splunk.rumSessionId'], 'Checking splunk.rumSessionId').toBeTruthy()

		// Attributes set on resource that zipkin exporter merges to span tags
		expect(exposedSpan.resource.attributes['telemetry.sdk.name'], 'Checking telemetry.sdk.name').toBeTruthy()
		expect(
			exposedSpan.resource.attributes['telemetry.sdk.language'],
			'Checking telemetry.sdk.language',
		).toBeTruthy()
		expect(exposedSpan.resource.attributes['telemetry.sdk.version'], 'Checking telemetry.sdk.version').toBeTruthy()
		expect(exposedSpan.resource.attributes['splunk.rumVersion'], 'Checking splunk.rumVersion').toBeTruthy()
		expect(exposedSpan.resource.attributes['splunk.scriptInstance'], 'Checking splunk.scriptInstance').toBeTruthy()
		expect(exposedSpan.resource.attributes['app']).toBe('my-app')
	})
})

describe('setGlobalAttributes', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should have extra fields added', () => {
		const tracer = SplunkRum.provider.getTracer('test')
		SplunkRum.setGlobalAttributes({ newKey: 'newVal' })
		const span = tracer.startSpan('testSpan')
		span.end()

		const exposedSpan = span as tracing.Span
		expect(exposedSpan.attributes.newKey).toBe('newVal')
		expect(exposedSpan.attributes.customerType).toBe('GOLD')
	})
})

// Doesn't actually test the xhr additions we've made (with Server-Timing), but just that
// we didn't mess up the basic flow/behavior of the plugin
describe('test xhr', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should capture an xhr span', async () => {
		const xhr = new XMLHttpRequest()
		xhr.open('GET', location.href)
		await new Promise<void>((resolve) => {
			xhr.addEventListener('loadend', () => {
				setTimeout(() => {
					resolve()
				}, 3000)
			})

			xhr.send()
		})

		const span = capturer.spans.find(
			(s) =>
				(s.attributes.component === 'xml-http-request' && (s.attributes['http.url'] as string)) ===
				location.href,
		)
		expect(span.name).toBe('HTTP GET')
		expect(span.attributes.component).toBe('xml-http-request')
		expect((span.attributes['http.response_content_length'] as number) > 0).toBeTruthy()
		// expect(span.attributes['link.spanId']).toBe('0000000000000002')
		expect(span.attributes['http.url']).toBe(location.href)

		capturer.clear()
	})
})

// See above comment on xhr test
describe('test fetch', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should capture a fetch span', async () => {
		await new Promise<void>((resolve) => {
			void window.fetch(location.href).then(() => {
				setTimeout(() => {
					resolve()
				}, 3000)
			})
		})

		const fetchSpan = capturer.spans.find((span) => span.attributes.component === 'fetch')
		expect(fetchSpan, 'Check if fetch span is present.').toBeTruthy()
		expect(fetchSpan.name).toBe('HTTP GET')

		// note: temporarily disabled because of instabilities in OTel's code
		// assert.ok(fetchSpan.attributes['http.response_content_length'] > 0, 'Checking response_content_length.');

		// expect(fetchSpan.attributes['link.spanId']).toBe('0000000000000002')
		expect(fetchSpan.attributes['http.url']).toBe(location.href)
	})
})

function reportError() {
	throw new Error("You can't fight in here; this is the war room!")
}

function callChain() {
	reportError()
}

describe('test error', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should capture an error span', async () => {
		const origOnError = window.onerror
		window.onerror = function () {
			// nop to prevent failing the test
		}

		capturer.clear()

		// cause the error
		setTimeout(() => {
			callChain()
		}, 10)

		await new Promise<void>((resolve) => {
			// and later look for it
			setTimeout(() => {
				window.onerror = origOnError // restore proper error handling
				resolve()
			}, 100)
		})

		const span = capturer.spans[capturer.spans.length - 1]
		expect(span.attributes.component).toBe('error')
		expect(span.name).toBe('onerror')
		expect((span.attributes['error.stack'] as string).includes('callChain')).toBeTruthy()
		expect((span.attributes['error.stack'] as string).includes('reportError')).toBeTruthy()
		expect((span.attributes['error.message'] as string).includes('war room')).toBeTruthy()
	})
})

function recurAndThrow(i: number) {
	if (i === 0) {
		throw new Error('bad thing')
	}

	recurAndThrow(i - 1)
}

describe('test stack length', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should limit length of stack', async () => {
		try {
			recurAndThrow(50)
		} catch (e) {
			try {
				SplunkRum.error('something happened: ', e) // try out the API
			} catch {
				// swallow
			}
		}

		await new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve()
			}, 100)
		})

		const errorSpan = capturer.spans.find((span) => span.attributes.component === 'error')
		expect(errorSpan).toBeTruthy()
		expect((errorSpan.attributes['error.stack'] as string).includes('recurAndThrow')).toBeTruthy()
		expect((errorSpan.attributes['error.stack'] as string).length <= 4096).toBeTruthy()
		expect((errorSpan.attributes['error.message'] as string).includes('something')).toBeTruthy()
		expect((errorSpan.attributes['error.message'] as string).includes('bad thing')).toBeTruthy()
	})
})

function throwBacon() {
	throw new Error('bacon')
}

describe('test unhandled promise rejection', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should report a span', async () => {
		void Promise.resolve('ok').then(() => {
			throwBacon()
		})

		await new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve()
			}, 100)
		})

		const errorSpan = capturer.spans.find((span) => span.attributes.component === 'error')
		expect(errorSpan).toBeTruthy()
		expect(errorSpan.attributes.error).toBeTruthy()
		expect((errorSpan.attributes['error.stack'] as string).includes('throwBacon')).toBeTruthy()
		expect((errorSpan.attributes['error.message'] as string).includes('bacon')).toBeTruthy()
	})
})

describe('test console.error', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should report a span', async () => {
		console.error('has', 'some', 'args')

		await new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve()
			}, 100)
		})

		const errorSpan = capturer.spans.find((span) => span.attributes.component === 'error')
		expect(errorSpan).toBeTruthy()
		expect(errorSpan.attributes['error.message']).toBe('has some args')
	})
})

describe('test unloaded img', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should report a span', async () => {
		capturer.clear()

		const img = document.createElement('img')
		img.src = location.href + '/IAlwaysWantToUseVeryVerboseDescriptionsWhenIHaveToEnsureSomethingDoesNotExist.jpg'
		document.body.appendChild(img)

		await new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve()
			}, 100)
		})

		const span = capturer.spans.find((s) => s.attributes.component === 'error')
		expect(span).toBeTruthy()
		expect(span.name).toBe('eventListener.error')
		expect((span.attributes.target_src as string).endsWith('DoesNotExist.jpg')).toBeTruthy()
	})
})

describe('test manual report', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should not report useless items', () => {
		capturer.clear()
		SplunkRum.error('')
		SplunkRum.error()
		SplunkRum.error([])
		SplunkRum.error({})
		expect(capturer.spans.length).toBe(0)
	})
})

describe('test route change', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('should report a span', () => {
		const oldUrl = location.href
		capturer.clear()
		history.pushState({}, 'title', '/thisIsAChange#WithAHash')
		const span = capturer.spans.find((s) => s.attributes.component === 'user-interaction')
		expect(span, 'Check if user-interaction span is present.').toBeTruthy()
		expect(span.name).toBe('routeChange')
		expect((span.attributes['location.href'] as string).includes('/thisIsAChange#WithAHash')).toBeTruthy()
		expect(oldUrl).toBe(span.attributes['prev.href'])
		history.pushState({}, 'title', '/')
	})

	it('should capture location.hash changes', async () => {
		const oldUrl = location.href
		location.hash = '#hashChange'

		await new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve()
			}, 0)
		})

		const span = capturer.spans.find((s) => s.attributes.component === 'user-interaction')
		expect(span, 'Check if user-interaction span is present.').toBeTruthy()
		expect(span.name).toBe('routeChange')
		expect((span.attributes['location.href'] as string).includes('#hashChange')).toBeTruthy()
		expect(oldUrl).toBe(span.attributes['prev.href'])
		history.pushState({}, 'title', '/')
	})
})

describe('can remove wrapped event listeners', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('does not break behavior', () => {
		let called = false
		const listener = function () {
			called = true
		}
		document.body.addEventListener('testy', listener)
		document.body.dispatchEvent(new Event('testy'))
		expect(called).toBe(true)
		called = false
		document.body.removeEventListener('testy', listener)
		document.body.dispatchEvent(new Event('testy'))
		expect(called).toBe(false)
	})
})

describe('event listener shenanigans', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	// https://github.com/angular/components/blob/59002e1649123922df3532f4be78c485a73c5bc1/src/cdk/platform/features/passive-listeners.ts#L21
	it("doesn't break on null listener", () => {
		document.body.addEventListener('test', null)
		// fails on throwing error
		document.body.removeEventListener('test', null)
	})

	// https://github.com/Pomax/react-onclickoutside/blob/15c3cdaed0d8314ac68bc53c7fad7b2c2f3c4ae2/src/index.js#L19
	it("doesn't break on null capture arg", () => {
		const listener = () => {}
		// fails on throwing error
		document.body.addEventListener('test', listener, null)
		document.body.removeEventListener('test', listener, null)
	})
})

describe('can produce click events', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer)
	})

	afterEach(() => {
		deinit()
	})

	it('creates a span for them', () => {
		capturer.clear()
		document.body.addEventListener('dblclick', function () {
			/* nop */
		})
		document.body.dispatchEvent(new Event('dblclick'))
		expect(capturer.spans.length).toBe(1)
		expect(capturer.spans[0].name).toBe('dblclick')
		expect(capturer.spans[0].attributes.component).toBe('user-interaction')
	})
})
