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

import { context, diag, trace } from '@opentelemetry/api'
import * as tracing from '@opentelemetry/sdk-trace-base'
import { expectDefined } from '@test-kit/common/assertions'
import { HTTP_TEST_SERVER_URL } from '@test-kit/servers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SplunkRum from '../src'
import {
	BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE,
	BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
	BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE,
	BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
	PAGE_LOAD_METRICS_STATUS_COMPLETED,
	PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
	PAGE_LOAD_METRICS_STATUS_TIMEOUT,
} from '../src/managers'
import { VERSION } from '../src/version'
import {
	deinit,
	getGlobalOtelApi,
	getTracer,
	initWithDefaultConfig,
	mockNavigator,
	setGlobalOtelApi,
	SpanCapturer,
} from './utils'

type FrustrationSignalsConfig = {
	deadClick?: { ignoreUrls?: Array<string | RegExp> }
	errorClick?: { ignoreUrls?: Array<string | RegExp> }
	thrashedCursor?: { ignoreUrls?: Array<string | RegExp> }
}

const doesBeaconUrlEndWith = (suffix: string) => {
	const sps = (SplunkRum.provider?.getActiveSpanProcessor() as any)._spanProcessors
	const exporterProcessor = sps.find(
		(spanProcessor: any) => spanProcessor?._exporter?.beaconUrl || spanProcessor?._exporter?.url,
	)
	expectDefined(exporterProcessor, 'Unable to find exporter span processor.')
	// TODO: refactor to make beaconUrl field private
	const beaconUrl = exporterProcessor._exporter.beaconUrl || exporterProcessor._exporter.url
	expect(beaconUrl.endsWith(suffix), `Checking beaconUrl if (${beaconUrl}) ends with ${suffix}`).toBeTruthy()
}

function init() {
	SplunkRum.init({
		applicationName: 'my-app',
		beaconEndpoint: 'https://127.0.0.1:9999/foo',
		deploymentEnvironment: 'my-env',
		globalAttributes: { customerType: 'GOLD' },
		instrumentations: {
			websocket: true,
		},
		rumAccessToken: undefined,
	})
}

describe('test init', () => {
	let capturer: SpanCapturer

	afterEach(() => {
		SplunkRum.deinit(true)

		expect(SplunkRum.inited).toBeFalsy()
		const globalApi = getGlobalOtelApi()
		expect(!globalApi['splunk.rum'])
		expect(!globalApi['splunk.rum.version'])
		expect(!globalApi['diag'])

		setGlobalOtelApi(undefined)

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
					applicationName: 'app',
					beaconEndpoint: undefined,
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
					applicationName: 'app',
					beaconEndpoint: 'http://127.0.0.1:8888/insecure',
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
				applicationName: 'app',
				beaconEndpoint: `https://127.0.0.1:8888/${path}`,
				rumAccessToken: undefined,
			})
			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith(path)
		})

		it('can be forced via allowInsecureBeacon option', () => {
			const path = '/insecure'
			SplunkRum.init({
				allowInsecureBeacon: true,
				applicationName: 'app',
				beaconEndpoint: `http://127.0.0.1:8888/${path}`,
				rumAccessToken: undefined,
			})

			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith(path)
		})

		it('can use realm config option', () => {
			SplunkRum.init({ applicationName: 'app', realm: 'test', rumAccessToken: undefined })

			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith('https://rum-ingest.test.observability.splunkcloud.com/v1/rumotlp')
		})

		it('can use realm + otlp config option', () => {
			SplunkRum.init({
				applicationName: 'app',
				exporter: {
					otlp: true,
				},
				realm: 'test',
				rumAccessToken: undefined,
			})
			expect(SplunkRum.inited).toBeTruthy()
			doesBeaconUrlEndWith('https://rum-ingest.test.observability.splunkcloud.com/v1/rumotlp')
		})

		it('warns when beaconEndpoint is specified and OTLP is not enabled', () => {
			const warnMock = vi.spyOn(diag, 'warn')

			SplunkRum.init({
				applicationName: 'app',
				beaconEndpoint: 'https://127.0.0.1:8888/zipkin',
				rumAccessToken: undefined,
			})

			expect(warnMock).toHaveBeenCalledWith(
				expect.stringContaining('Zipkin will be removed in the next major version in favor of OTLP'),
			)
		})
	})

	describe('ignoreUrls normalization', () => {
		it('converts regex strings recursively for each ignoreUrls key and URL override match', () => {
			const initOptions = {
				applicationName: 'app',
				beaconEndpoint: 'https://127.0.0.1:8888/foo',
				ignoreUrls: ['regex/test-top-level/', '/exact-match'],
				instrumentations: {
					fetch: { ignoreUrls: ['regex/fetch-regex/', 'exact'] },
					frustrationSignals: {
						deadClick: { ignoreUrls: ['regex/dead-click/', 'exact'] },
						errorClick: { ignoreUrls: ['regex/error-click/', 'exact'] },
						thrashedCursor: { ignoreUrls: ['regex/thrashed-cursor/', 'exact'] },
					},
					xhr: { ignoreUrls: ['regex/xhr-regex/', 'exact'] },
				},
				rumAccessToken: undefined,
				spaMetrics: {
					ignoreUrls: ['regex/spa-metrics/', 'exact'],
					urlOverrides: [
						{
							ignoreUrls: ['regex/spa-metrics-override/', 'exact-override'],
							match: 'regex/checkout/',
						},
					],
				},
			}

			SplunkRum.init(initOptions)

			expect(SplunkRum.inited).toBeTruthy()

			const processedOptions = SplunkRum._processedOptions
			expect(processedOptions).toBeTruthy()
			expect(initOptions.ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.instrumentations.frustrationSignals.deadClick.ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.instrumentations.frustrationSignals.deadClick.ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.instrumentations.frustrationSignals.errorClick.ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.instrumentations.frustrationSignals.errorClick.ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.instrumentations.frustrationSignals.thrashedCursor.ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.instrumentations.frustrationSignals.thrashedCursor.ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.instrumentations.xhr.ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.instrumentations.xhr.ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.instrumentations.fetch.ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.instrumentations.fetch.ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.spaMetrics.ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.spaMetrics.ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.spaMetrics.urlOverrides[0].ignoreUrls[0]).toBeInstanceOf(RegExp)
			expect(initOptions.spaMetrics.urlOverrides[0].ignoreUrls[1]).toBeTypeOf('string')
			expect(initOptions.spaMetrics.urlOverrides[0].match).toBeInstanceOf(RegExp)

			const frustrationSignalsConfig = processedOptions?.instrumentations?.frustrationSignals as
				| FrustrationSignalsConfig
				| undefined

			expect(processedOptions?.ignoreUrls?.[0]).toBeInstanceOf(RegExp)
			expect(
				processedOptions?.ignoreUrls?.[0] instanceof RegExp &&
					processedOptions.ignoreUrls[0].test('test-top-level'),
			).toBeTruthy()
			expect(processedOptions?.ignoreUrls?.[1]).toBe('/exact-match')
			expect(frustrationSignalsConfig?.deadClick?.ignoreUrls?.[0]).toBeInstanceOf(RegExp)
			expect(frustrationSignalsConfig?.errorClick?.ignoreUrls?.[0]).toBeInstanceOf(RegExp)
			expect(frustrationSignalsConfig?.thrashedCursor?.ignoreUrls?.[0]).toBeInstanceOf(RegExp)

			const spaMetricsConfig = processedOptions?.spaMetrics as
				| {
						ignoreUrls?: Array<string | RegExp>
						urlOverrides?: Array<{ ignoreUrls?: Array<string | RegExp>; match?: string | RegExp }>
				  }
				| undefined
			expect(spaMetricsConfig?.ignoreUrls?.[0]).toBeInstanceOf(RegExp)
			expect(spaMetricsConfig?.urlOverrides?.[0]?.ignoreUrls?.[0]).toBeInstanceOf(RegExp)
			expect(spaMetricsConfig?.urlOverrides?.[0]?.match).toBeInstanceOf(RegExp)
		})
	})

	describe('successful', () => {
		it('should have been inited properly with doc load spans', async () => {
			SplunkRum.init({
				applicationName: 'my-app',
				beaconEndpoint: 'https://127.0.0.1:9999/foo',
				deploymentEnvironment: 'my-env',
				globalAttributes: { customerType: 'GOLD' },
				instrumentations: {
					websocket: true,
				},
				rumAccessToken: undefined,
				spanProcessors: [capturer],
			})

			expect(SplunkRum.inited).toBeTruthy()

			await vi.waitFor(
				() => {
					expect(capturer.spans.some((span) => span.name === 'documentLoad')).toBeTruthy()
				},
				{ timeout: 6000 },
			)

			expect(capturer.spans.length >= 3).toBeTruthy()
			const docLoadTraceId = capturer.spans.find((span) => span.name === 'documentLoad')?.spanContext().traceId

			capturer.spans
				.filter((span) => span.attributes['component'] === 'document-load')
				.forEach((span) => {
					expect(span.spanContext().traceId).toBe(docLoadTraceId)
				})

			const documentFetchSpan = capturer.spans.find((span) => span.name === 'documentFetch')
			expectDefined(documentFetchSpan, 'documentFetch span presence.')

			const documentLoadSpan = capturer.spans.find((span) => span.name === 'documentLoad')
			expectDefined(documentLoadSpan, 'documentLoad span presence.')
			expect(documentLoadSpan).toHaveSpanAttribute(BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE)
			expect(documentLoadSpan).toHaveSpanAttribute(
				BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
				PAGE_LOAD_METRICS_STATUS_COMPLETED,
			)
			expect(documentLoadSpan).toHaveSpanAttributeMatching('screen.xy', /^[0-9]+x[0-9]+$/)

			const resourceFetchSpan = capturer.spans.find((span) => span.name === 'resourceFetch')
			expectDefined(resourceFetchSpan, 'resourceFetch span presence.')
		})

		it('sets timeout status on documentLoad span when PCT computation times out', async () => {
			SplunkRum.init({
				applicationName: 'my-app',
				beaconEndpoint: 'https://127.0.0.1:9999/foo',
				deploymentEnvironment: 'my-env',
				globalAttributes: { customerType: 'GOLD' },
				rumAccessToken: undefined,
				spaMetrics: {
					maxPageLoadWaitTime: 3000,
					quietTime: 1000,
				},
				spanProcessors: [capturer],
			})

			const slowResourceAbortController = new AbortController()
			const slowResourceUrl = `${HTTP_TEST_SERVER_URL}/some-data?delay=5000`
			void fetch(slowResourceUrl, {
				signal: slowResourceAbortController.signal,
			}).catch(() => {})

			try {
				await vi.waitFor(
					() => {
						const documentLoadSpan = capturer.spans.find((span) => span.name === 'documentLoad')
						expectDefined(documentLoadSpan, 'documentLoad span presence.')
						expect(documentLoadSpan).toHaveSpanAttribute(
							BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE,
							3000,
						)
						expect(documentLoadSpan).toHaveSpanAttribute(
							BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
							PAGE_LOAD_METRICS_STATUS_TIMEOUT,
						)
						expect(documentLoadSpan).toHaveSpanAttribute(
							BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE,
							1,
						)
						expect(documentLoadSpan).toHaveSpanAttribute(
							BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
							JSON.stringify([slowResourceUrl]),
						)
					},
					{ timeout: 6000 },
				)
			} finally {
				slowResourceAbortController.abort()
			}
		})

		it('sets interrupted status on documentLoad span when page hides during PCT computation', async () => {
			SplunkRum.init({
				applicationName: 'my-app',
				beaconEndpoint: 'https://127.0.0.1:9999/foo',
				deploymentEnvironment: 'my-env',
				globalAttributes: { customerType: 'GOLD' },
				rumAccessToken: undefined,
				spaMetrics: {
					maxPageLoadWaitTime: 3000,
					quietTime: 1000,
				},
				spanProcessors: [capturer],
			})

			const slowResourceAbortController = new AbortController()
			const slowResourceUrl = `${HTTP_TEST_SERVER_URL}/some-data?delay=5000`
			void fetch(slowResourceUrl, {
				signal: slowResourceAbortController.signal,
			}).catch(() => {})

			try {
				window.dispatchEvent(new Event('pagehide'))

				await vi.waitFor(
					() => {
						const documentLoadSpan = capturer.spans.find((span) => span.name === 'documentLoad')
						expectDefined(documentLoadSpan, 'documentLoad span presence.')
						expect(documentLoadSpan).toHaveSpanAttribute(
							BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
							PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
						)
						expect(documentLoadSpan).toHaveSpanAttribute(
							BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE,
							1,
						)
						expect(documentLoadSpan).toHaveSpanAttribute(
							BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
							JSON.stringify([slowResourceUrl]),
						)
					},
					{ timeout: 6000 },
				)
			} finally {
				slowResourceAbortController.abort()
			}
		})
	})
	describe('double-init has no effect', () => {
		it('should have been inited only once', () => {
			SplunkRum.init({
				applicationName: 'app',
				beaconEndpoint: 'https://127.0.0.1:8888/foo',
				rumAccessToken: undefined,
			})
			SplunkRum.init({
				applicationName: 'app',
				beaconEndpoint: 'https://127.0.0.1:8888/bar',
				rumAccessToken: undefined,
			})
			doesBeaconUrlEndWith('/foo')
		})
	})

	describe('exporter option', () => {
		it('allows setting factory', async () => {
			// eslint-disable-next-line unicorn/no-useless-undefined
			const exportMock = vi.fn().mockReturnValue(undefined)
			// eslint-disable-next-line unicorn/no-useless-undefined
			const onAttributesSerializingMock = vi.fn().mockReturnValue(undefined)

			SplunkRum._internalInit({
				allowInsecureBeacon: true,
				applicationName: 'my-app',
				beaconEndpoint: 'https://domain1',
				bufferTimeout: 0,
				deploymentEnvironment: 'my-env',
				exporter: {
					factory: (options) => {
						expect(options.onAttributesSerializing).toBe(onAttributesSerializingMock)
						return {
							export: exportMock,
							shutdown: () => Promise.resolve(),
						}
					},
					onAttributesSerializing: onAttributesSerializingMock,
				},
				globalAttributes: { customerType: 'GOLD' },
				rumAccessToken: '123-no-warn-spam-in-console',
			})
			getTracer('test').startSpan('testSpan').end()

			await expect.poll(() => exportMock.mock.calls.length > 0).toBeTruthy()
		})
	})

	describe('multiple instance protection', () => {
		it('sets the global version flag', () => {
			init()
			expect(SplunkRum.inited).toBeTruthy()

			const globalApi = getGlobalOtelApi()

			expect(typeof globalApi['splunk.rum.version'] === 'string').toBeTruthy()
			expect(typeof globalApi['splunk.rum'] === 'object').toBeTruthy()
			expect(globalApi['splunk.rum']).toBeTruthy()
		})

		it('fails the init if the version does not match', () => {
			const globalApi: Record<string, unknown> = {}
			setGlobalOtelApi(globalApi)
			globalApi['splunk.rum.version'] = '1.2.3'
			init()
			expect(SplunkRum.inited).toBeFalsy()
		})

		it('fails the init if splunk.rum already exists', () => {
			const globalApi: Record<string, unknown> = {}
			setGlobalOtelApi(globalApi)
			globalApi['splunk.rum.version'] = VERSION
			globalApi['splunk.rum'] = {}
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
		const tracer = getTracer('test')

		const span = tracer.startSpan('testSpan')

		context.with(trace.setSpan(context.active(), span), () => {
			expect(trace.getSpan(context.active())).toStrictEqual(span)
		})
		span.end()

		const exposedSpan = span as tracing.Span
		expect(exposedSpan).toHaveSpanAttribute('location.href')
		expect(exposedSpan).toHaveSpanAttribute('environment', 'my-env')
		expect(exposedSpan).toHaveSpanAttribute('app.version', '1.2-test.3')
		expect(exposedSpan).toHaveSpanAttribute('customerType', 'GOLD')
		expect(exposedSpan).toHaveSpanAttribute('splunk.rumSessionId')

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
		const tracer = getTracer('test')
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
		expectDefined(span)
		expect(span.name).toBe('HTTP GET')
		expect(span).toHaveSpanAttribute('component', 'xml-http-request')
		expect((span.attributes['http.response_content_length'] as number) > 0).toBeTruthy()
		// expect(span.attributes['link.spanId']).toBe('0000000000000002')
		expect(span).toHaveSpanAttribute('http.url', location.href)

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
		expectDefined(fetchSpan, 'Check if fetch span is present.')
		expect(fetchSpan.name).toBe('HTTP GET')

		// note: temporarily disabled because of instabilities in OTel's code
		// assert.ok(fetchSpan.attributes['http.response_content_length'] > 0, 'Checking response_content_length.');

		// expect(fetchSpan.attributes['link.spanId']).toBe('0000000000000002')
		expect(fetchSpan).toHaveSpanAttribute('http.url', location.href)
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
		// eslint-disable-next-line unicorn/prefer-add-event-listener
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
				// eslint-disable-next-line unicorn/prefer-add-event-listener
				window.onerror = origOnError // restore proper error handling
				resolve()
			}, 100)
		})

		const span = capturer.spans.at(-1)
		expectDefined(span)
		expect(span).toHaveSpanAttribute('component', 'error')
		expect(span.name).toBe('onerror')
		expect(span).toHaveSpanAttributeContaining('error.stack', 'callChain')
		expect(span).toHaveSpanAttributeContaining('error.stack', 'reportError')
		expect(span).toHaveSpanAttributeContaining('error.message', 'war room')
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
		} catch (error) {
			try {
				await SplunkRum.reportError(error as Error)
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
		expectDefined(errorSpan)
		expect(errorSpan).toHaveSpanAttributeContaining('error.stack', 'recurAndThrow')
		expect((errorSpan.attributes['error.stack'] as string).length <= 4096).toBeTruthy()
		expect(errorSpan).toHaveSpanAttributeContaining('error.message', 'bad thing')
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

		const errorSpans = capturer.spans.filter((span) => span.attributes.component === 'error')

		expect(errorSpans.length).toBe(2)

		// first one is PromiseRejection, second one is from the throw
		expect(errorSpans[0]).toBeTruthy()
		expect(errorSpans[0]).toNotHaveSpanAttribute('error')
		expect(errorSpans[0]).toHaveSpanAttribute('error.type', 'unhandledrejection')
		expect(errorSpans[1]).toBeTruthy()
		expect(errorSpans[1]).toHaveSpanAttribute('error')
		expect(errorSpans[1]).toHaveSpanAttributeContaining('error.stack', 'throwBacon')
		expect(errorSpans[1]).toHaveSpanAttributeContaining('error.message', 'bacon')
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
		expectDefined(errorSpan)
		expect(errorSpan).toHaveSpanAttribute('error.message', 'has some args')
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
		document.body.append(img)

		await new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve()
			}, 100)
		})

		const span = capturer.spans.find((s) => s.attributes.component === 'error')
		expectDefined(span)
		expect(span.name).toBe('eventListener.error')
		expect(span).toHaveSpanAttributeContaining('target_src', 'DoesNotExist.jpg')
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

	it('should not report useless items', async () => {
		capturer.clear()
		await SplunkRum.reportError('')
		// @ts-expect-error testing invalid arg
		await SplunkRum.reportError()
		// @ts-expect-error testing invalid arg
		await SplunkRum.reportError([])
		// @ts-expect-error testing invalid arg
		await SplunkRum.reportError({})
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
		expectDefined(span, 'Check if user-interaction span is present.')
		expect(span.name).toBe('routeChange')
		expect(span).toHaveSpanAttributeContaining('location.href', '/thisIsAChange#WithAHash')
		expect(span).toHaveSpanAttribute('prev.href', oldUrl)
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
		expectDefined(span, 'Check if user-interaction span is present.')
		expect(span.name).toBe('routeChange')
		expect(span).toHaveSpanAttributeContaining('location.href', '#hashChange')
		expect(span).toHaveSpanAttribute('prev.href', oldUrl)
		history.pushState({}, 'title', '/')
	})

	it('should capture consecutive location.hash changes with correct previous and current URLs', async () => {
		history.replaceState({}, 'title', '/')
		const oldUrl = location.href
		capturer.clear()

		location.hash = '#a'
		location.hash = '#b'

		await vi.waitFor(() => {
			const spans_ = capturer.spans.filter((s) => s.name === 'routeChange')
			expect(spans_).toHaveLength(2)
		})

		const spans = capturer.spans.filter((s) => s.name === 'routeChange')
		expect(spans[0]).toHaveSpanAttribute('prev.href', oldUrl)
		expect(spans[0]).toHaveSpanAttribute('location.href', `${oldUrl}#a`)
		expect(spans[1]).toHaveSpanAttribute('prev.href', `${oldUrl}#a`)
		expect(spans[1]).toHaveSpanAttribute('location.href', `${oldUrl}#b`)

		history.replaceState({}, 'title', '/')
	})
})

describe('test route change spa metrics timeout', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
		initWithDefaultConfig(capturer, {
			spaMetrics: {
				maxPageLoadWaitTime: 3000,
				quietTime: 1000,
			},
		})
	})

	afterEach(() => {
		deinit()
		history.pushState({}, 'title', '/')
	})

	it('sets completed status on routeChange span when PCT computation completes', async () => {
		const oldUrl = location.href

		history.pushState({}, 'title', '/pctCompleted#WithAHash')

		await vi.waitFor(
			() => {
				const span = capturer.spans.find((s) => s.name === 'routeChange')
				expectDefined(span, 'Check if routeChange span is present.')
				expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE)
				expect(span).toHaveSpanAttribute(
					BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
					PAGE_LOAD_METRICS_STATUS_COMPLETED,
				)
				expect(span).toHaveSpanAttribute('prev.href', oldUrl)
			},
			{ timeout: 6000 },
		)
	})

	it('sets timeout status on routeChange span when PCT computation times out', async () => {
		const oldUrl = location.href
		const slowResourceAbortController = new AbortController()
		const slowResourceUrl = `${HTTP_TEST_SERVER_URL}/some-data?delay=5000`

		try {
			history.pushState({}, 'title', '/pctTimeout#WithAHash')
			void fetch(slowResourceUrl, {
				signal: slowResourceAbortController.signal,
			}).catch(() => {})

			await vi.waitFor(
				() => {
					const span = capturer.spans.find((s) => s.name === 'routeChange')
					expectDefined(span, 'Check if routeChange span is present.')
					expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE, 3000)
					expect(span).toHaveSpanAttribute(
						BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
						PAGE_LOAD_METRICS_STATUS_TIMEOUT,
					)
					expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE, 1)
					expect(span).toHaveSpanAttribute(
						BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
						JSON.stringify([slowResourceUrl]),
					)
					expect(span).toHaveSpanAttribute('prev.href', oldUrl)
				},
				{ timeout: 6000 },
			)
		} finally {
			slowResourceAbortController.abort()
		}
	})

	it('sets interrupted status on routeChange span when page hides during PCT computation', async () => {
		const oldUrl = location.href
		const slowResourceAbortController = new AbortController()
		const slowResourceUrl = `${HTTP_TEST_SERVER_URL}/some-data?delay=5000`

		try {
			history.pushState({}, 'title', '/pctInterrupted#WithAHash')
			void fetch(slowResourceUrl, {
				signal: slowResourceAbortController.signal,
			}).catch(() => {})
			window.dispatchEvent(new Event('pagehide'))

			await vi.waitFor(
				() => {
					const span = capturer.spans.find((s) => s.name === 'routeChange')
					expectDefined(span, 'Check if routeChange span is present.')
					expect(span).toHaveSpanAttribute(
						BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
						PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
					)
					expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE, 1)
					expect(span).toHaveSpanAttribute(
						BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE,
						JSON.stringify([slowResourceUrl]),
					)
					expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE)
					expect(span).toHaveSpanAttribute('prev.href', oldUrl)
				},
				{ timeout: 6000 },
			)
		} finally {
			slowResourceAbortController.abort()
		}
	})

	it('does not set loading resource count on interrupted routeChange span when no resources are loading', async () => {
		const oldUrl = location.href

		history.pushState({}, 'title', '/pctInterruptedNoResources#WithAHash')
		window.dispatchEvent(new Event('pagehide'))

		await vi.waitFor(
			() => {
				const span = capturer.spans.find((s) => s.name === 'routeChange')
				expectDefined(span, 'Check if routeChange span is present.')
				expect(span).toHaveSpanAttribute(
					BROWSER_NAVIGATION_STATUS_ATTRIBUTE,
					PAGE_LOAD_METRICS_STATUS_INTERRUPTED,
				)
				expect(span).toNotHaveSpanAttribute(BROWSER_NAVIGATION_LOADING_RESOURCE_COUNT_ATTRIBUTE)
				expect(span).toNotHaveSpanAttribute(BROWSER_NAVIGATION_LOADING_RESOURCE_URLS_ATTRIBUTE)
				expect(span).toHaveSpanAttribute(BROWSER_NAVIGATION_PAGE_COMPLETION_TIME_ATTRIBUTE)
				expect(span).toHaveSpanAttribute('prev.href', oldUrl)
			},
			{ timeout: 6000 },
		)
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
		// @ts-expect-error testing invalid arg
		document.body.addEventListener('test', null)
		// @ts-expect-error testing invalid arg
		document.body.removeEventListener('test', null)
	})

	// https://github.com/Pomax/react-onclickoutside/blob/15c3cdaed0d8314ac68bc53c7fad7b2c2f3c4ae2/src/index.js#L19
	it("doesn't break on null capture arg", () => {
		// eslint-disable-next-line unicorn/consistent-function-scoping
		const listener = () => {}

		// @ts-expect-error testing invalid arg
		document.body.addEventListener('test', listener, null)
		// @ts-expect-error testing invalid arg
		document.body.removeEventListener('test', listener, null)
	})
})

describe('platform attributes', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
	})

	afterEach(() => {
		deinit()
	})

	it('should include basic platform information in global attributes', () => {
		mockNavigator({
			platform: 'Win32',
			userAgentData: {
				platform: 'Windows',
			},
		})

		SplunkRum.init({
			applicationName: 'test-app',
			beaconEndpoint: 'https://127.0.0.1:9999/test',
			rumAccessToken: undefined,
			spanProcessors: [capturer],
		})

		expect(SplunkRum.inited).toBeTruthy()

		// Check that platform.name is in global attributes
		const globalAttributes = SplunkRum.getGlobalAttributes()
		expect(globalAttributes['user_agent.os.name']).toBe('Windows')
	})

	it('should fallback to navigator.platform when userAgentData is not available', () => {
		mockNavigator({
			platform: 'MacIntel',
		})

		SplunkRum.init({
			applicationName: 'test-app',
			beaconEndpoint: 'https://127.0.0.1:9999/test',
			rumAccessToken: undefined,
			spanProcessors: [capturer],
		})

		const globalAttributes = SplunkRum.getGlobalAttributes()
		expect(globalAttributes['user_agent.os.name']).toBe('MacIntel')
	})

	it('should automatically update platform attributes with enhanced information', async () => {
		mockNavigator({
			platform: 'Linux x86_64',
			userAgentData: {
				getHighEntropyValues: vi.fn().mockResolvedValue({
					platformVersion: '5.4.0',
				}),
				platform: 'Linux',
			},
		})

		SplunkRum.init({
			applicationName: 'test-app',
			beaconEndpoint: 'https://127.0.0.1:9999/test',
			rumAccessToken: undefined,
			spanProcessors: [capturer],
		})

		// Initially should have basic platform info
		let globalAttributes = SplunkRum.getGlobalAttributes()
		expect(globalAttributes['user_agent.os.name']).toBe('Linux')

		// Wait for automatic platform attributes update to complete
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Should now have enhanced platform info automatically
		globalAttributes = SplunkRum.getGlobalAttributes()
		expect(globalAttributes['user_agent.os.name']).toBe('Linux')
		expect(globalAttributes['user_agent.os.version']).toBe('5.4.0')
	})

	it('should apply platform attributes to spans', async () => {
		mockNavigator({
			platform: 'Win32',
			userAgentData: {
				platform: 'Windows',
			},
		})

		SplunkRum.init({
			applicationName: 'test-app',
			beaconEndpoint: 'https://127.0.0.1:9999/test',
			rumAccessToken: undefined,
			spanProcessors: [capturer],
		})

		// Create a test span
		const tracer = getTracer('test')
		const span = tracer.startSpan('test-span')
		span.end()

		// Wait for span to be processed
		await new Promise((resolve) => setTimeout(resolve, 100))

		expect(capturer.spans.length).toBeGreaterThan(0)
		const testSpan = capturer.spans.find((s) => s.name === 'test-span')
		expectDefined(testSpan)
		expect(testSpan).toHaveSpanAttribute('user_agent.os.name', 'Windows')
	})

	it('should add experimental browser debug attributes to spans when enabled', async () => {
		mockNavigator({
			connection: {
				effectiveType: '4g',
				rtt: 25,
			},
			deviceMemory: 16,
			hardwareConcurrency: 8,
			platform: 'Win32',
			userAgentData: {
				platform: 'Windows',
			},
		})

		SplunkRum.init({
			_experimental_captureBrowserDebugAttributes: true,
			applicationName: 'test-app',
			beaconEndpoint: 'https://127.0.0.1:9999/test',
			rumAccessToken: undefined,
			spanProcessors: [capturer],
		})

		const tracer = getTracer('test')
		const span = tracer.startSpan('test-span')
		span.end()

		await new Promise((resolve) => setTimeout(resolve, 100))

		const testSpan = capturer.spans.find((s) => s.name === 'test-span')
		expectDefined(testSpan)
		expect(testSpan).toHaveSpanAttribute('browser.debug.hardware_concurrency', 8)
		expect(testSpan).toHaveSpanAttribute('browser.debug.device_memory_gb', 16)
		expect(testSpan).toHaveSpanAttribute('browser.debug.connection.effective_type', '4g')
		expect(testSpan).toHaveSpanAttribute('browser.debug.connection.rtt', 25)
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

	it('marks elements matching configured interactive selectors as interactive', () => {
		deinit()
		initWithDefaultConfig(capturer, {
			instrumentations: {
				interactions: {
					experimental_interactiveElementSelectors: ['.custom-interactive'],
				},
			},
		})

		const element = document.createElement('div')
		element.className = 'custom-interactive'
		document.body.append(element)

		element.addEventListener('click', function () {
			/* nop */
		})
		element.dispatchEvent(new Event('click'))

		expect(capturer.spans.length).toBe(1)
		expect(capturer.spans[0]).toHaveSpanAttribute('target_interactive', true)

		element.remove()
	})
})

describe('external session handling', () => {
	let capturer: SpanCapturer

	beforeEach(() => {
		capturer = new SpanCapturer()
	})

	afterEach(() => {
		deinit()
		window.SplunkRumExternal = undefined
	})

	it('should not create session.start span for external sessions', async () => {
		const now = Date.now()
		const sessionStart = now - performance.now()

		window.SplunkRumExternal = {
			getSessionMetadata: vi.fn().mockReturnValue({
				anonymousUserId: 'external-anon-id-123',
				sessionId: 'external-session-id-123',
				sessionLastActivity: now,
				sessionStart,
			}),
		}

		SplunkRum.init({
			applicationName: 'test-app',
			beaconEndpoint: 'https://127.0.0.1:9999/test',
			rumAccessToken: undefined,
			spanProcessors: [capturer],
		})

		expect(SplunkRum.inited).toBeTruthy()

		await new Promise((resolve) => setTimeout(resolve, 500))

		// Verify no session.start span was created
		const sessionStartSpan = capturer.spans.find((span) => span.name === 'session.start')
		expect(sessionStartSpan).toBeUndefined()

		// Verify session state has external source
		const sessionState = SplunkRum.getSessionState()
		expect(sessionState?.source).toBe('external')
		expect(sessionState?.id).toBe('external-session-id-123')
	})

	it('should create session.start span for web sessions', async () => {
		window.SplunkRumExternal = undefined

		SplunkRum.init({
			applicationName: 'test-app',
			beaconEndpoint: 'https://127.0.0.1:9999/test',
			rumAccessToken: undefined,
			spanProcessors: [capturer],
		})

		expect(SplunkRum.inited).toBeTruthy()

		await new Promise((resolve) => setTimeout(resolve, 500))

		// Verify session.start span was created
		const sessionStartSpan = capturer.spans.find((span) => span.name === 'session.start')
		expectDefined(sessionStartSpan)

		// Verify session state has web source
		const sessionState = SplunkRum.getSessionState()
		expect(sessionState?.source).toBe('web')
	})
})
