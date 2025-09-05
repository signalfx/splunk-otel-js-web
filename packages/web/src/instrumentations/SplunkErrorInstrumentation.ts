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

import { context, diag, Span } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'
import { getElementXPath } from '@opentelemetry/sdk-trace-web'
import * as shimmer from 'shimmer'

import { isElement } from '../types'
import { limitLen } from '../utils'
import { getValidAttributes, isPlainObject, removePropertiesWithAdvancedTypes, SpanContext } from '../utils/attributes'

// FIXME take timestamps from events?

const STACK_LIMIT = 4096
const MESSAGE_LIMIT = 1024

export const STACK_TRACE_URL_PATTER = /[\w]+:\/\/[^\s]+?(?::\d+)?(?=:[\d]+:[\d]+)/g

// Array<any> comes from handling console.error(...args) which could have any types
// we are selective about handling any[], if there's something in there that is unexpected
// then we can attempt to stringify or just drop it
export type InternalErrorLike = string | Event | Error | ErrorEvent | Array<any>

function useful(s: string) {
	return s && s.trim() !== '' && !s.startsWith('[object') && s !== 'error'
}

function stringifyValue(value: unknown) {
	if (value === undefined) {
		return '(undefined)'
	}

	if (value === null) {
		return '(null)'
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#null-prototype_objects
	// Check for null-prototype objects
	if (value.toString) {
		return value.toString()
	}

	try {
		return Object.prototype.toString.call(value)
	} catch {
		return '(unknown)'
	}
}

function parseErrorStack(stack: string): string {
	//get list of files in stack , find corresponding sourcemap id and add it to the source map id object
	const sourceMapIds: Record<string, string> = {}
	const urls = stack.match(STACK_TRACE_URL_PATTER)
	if (urls) {
		urls.forEach((url) => {
			// Strip off any line/column numbers at the end after the last colon
			const cleanedUrl = url.split(/:(?=\d+$)/)[0]
			const globalSourceMapIds = (window as any).sourceMapIds
			if (globalSourceMapIds && globalSourceMapIds[cleanedUrl] && !sourceMapIds[cleanedUrl]) {
				sourceMapIds[cleanedUrl] = globalSourceMapIds[cleanedUrl]
			}
		})
	}

	return JSON.stringify(sourceMapIds)
}

function addStackIfUseful(span: Span, err: Error) {
	if (err && err.stack && useful(err.stack)) {
		// get sourcemap ids and add to span as error.source_map_ids
		span.setAttribute('error.stack', limitLen(err.stack.toString(), STACK_LIMIT))
		const sourcemapIds = parseErrorStack(err.stack)
		if (sourcemapIds) {
			span.setAttribute('error.source_map_ids', sourcemapIds)
		}
	}
}

export const ERROR_INSTRUMENTATION_NAME = 'errors'
export const ERROR_INSTRUMENTATION_VERSION = '1'
const THROTTLE_LIMIT = 1000

type BackwardsCompatErrorLike = InternalErrorLike | any[]
type ErrorWithContext = { context: SpanContext; error: BackwardsCompatErrorLike }
type ErrorTransformer = (arg: InternalErrorLike, context: SpanContext) => ErrorWithContext | null

export type SplunkErrorInstrumentationConfig = InstrumentationConfig & {
	onError?: ErrorTransformer
}
const DEFAULT_ON_ERROR: ErrorTransformer = (e, c) => ({ context: c, error: e })

export class SplunkErrorInstrumentation extends InstrumentationBase {
	private clearingIntervalId?: ReturnType<typeof setInterval>

	private throttleMap = new Map<string, number>()

	constructor(protected _splunkConfig: SplunkErrorInstrumentationConfig) {
		super(ERROR_INSTRUMENTATION_NAME, ERROR_INSTRUMENTATION_VERSION, _splunkConfig)
	}

	disable(): void {
		shimmer.unwrap(console, 'error')
		window.removeEventListener('unhandledrejection', this.unhandledRejectionListener)
		window.removeEventListener('error', this.errorListener)
		document.documentElement.removeEventListener('error', this.documentErrorListener, { capture: true })
		clearInterval(this.clearingIntervalId)
		this.throttleMap.clear()
	}

	enable(): void {
		shimmer.wrap(console, 'error', this.consoleErrorHandler)
		window.addEventListener('unhandledrejection', this.unhandledRejectionListener)
		window.addEventListener('error', this.errorListener)
		document.documentElement.addEventListener('error', this.documentErrorListener, { capture: true })
		this.attachClearingInterval()
	}

	init(): void {}

	isValidContext = (ctx: SpanContext) => isPlainObject(ctx)

	isValidErrorArg = (errorArg: unknown): errorArg is BackwardsCompatErrorLike =>
		errorArg instanceof Error ||
		errorArg instanceof ErrorEvent ||
		errorArg instanceof Event ||
		typeof errorArg === 'string'

	report(source: string, arg: InternalErrorLike, spanContext: SpanContext): void {
		if (Array.isArray(arg) && arg.length === 0) {
			return
		}

		if (arg instanceof Array && arg.length === 1) {
			arg = arg[0]
		}

		const transformed = this.transform(arg, spanContext)
		if (transformed === null) {
			// reporting was cancelled
			return
		}

		const { context: transformedCtx, error: transformedArg } = transformed
		if (transformedArg instanceof Error) {
			this.reportError(source, transformedArg, transformedCtx)
		} else if (transformedArg instanceof ErrorEvent) {
			this.reportErrorEvent(source, transformedArg, transformedCtx)
		} else if (transformedArg instanceof Event) {
			this.reportEvent(source, transformedArg, transformedCtx)
		} else if (typeof transformedArg === 'string') {
			this.reportString(source, transformedArg, undefined, transformedCtx)
		} else if (Array.isArray(transformedArg)) {
			// if any arguments are Errors then add the stack trace even though the message is handled differently
			const firstError = transformedArg.find((x) => x instanceof Error)
			this.reportString(
				source,
				transformedArg.map((x) => stringifyValue(x)).join(' '),
				firstError,
				transformedCtx,
			)
		} else {
			this.reportString(source, stringifyValue(transformedArg), undefined, transformedCtx) // FIXME or JSON.stringify?
		}
	}

	protected reportError(source: string, err: Error, spanContext: SpanContext): void {
		const msg = err.message || err.toString()
		if (!useful(msg) && !err.stack) {
			return
		}

		const now = Date.now()
		const span = this.tracer.startSpan(source, { startTime: now })

		this.attachSpanContext(span, err, spanContext)

		span.setAttribute('component', 'error')
		span.setAttribute('error', true)
		span.setAttribute(
			'error.object',
			useful(err.name) ? err.name : err.constructor && err.constructor.name ? err.constructor.name : 'Error',
		)
		span.setAttribute('error.message', limitLen(msg, MESSAGE_LIMIT))
		addStackIfUseful(span, err)

		this.endSpanWithThrottle(span, now)
	}

	protected reportErrorEvent(source: string, ev: ErrorEvent, spanContext: SpanContext): void {
		if (ev.error) {
			this.report(source, ev.error, spanContext)
		} else if (ev.message) {
			this.report(source, ev.message, spanContext)
		}
	}

	protected reportEvent(source: string, ev: Event, spanContext: SpanContext): void {
		// FIXME consider other sources of global 'error' DOM callback - what else can be captured here?
		if (!ev.target && !useful(ev.type)) {
			return
		}

		const now = Date.now()
		const span = this.tracer.startSpan(source, { startTime: now })
		this.attachSpanContext(span, ev, spanContext)
		span.setAttribute('component', 'error')
		span.setAttribute('error.type', ev.type)
		if (ev.target) {
			span.setAttribute('target_xpath', getElementXPath(ev.target, true))

			if (isElement(ev.target)) {
				span.setAttribute('target_element', ev.target.tagName)

				let srcToDisplay = ev.target.getAttribute('src') ?? ''
				if (srcToDisplay.startsWith('blob://')) {
					srcToDisplay = 'blob://'
				} else if (srcToDisplay.startsWith('data:')) {
					srcToDisplay = `${srcToDisplay.slice(0, 47)}...`
				} else {
					srcToDisplay = srcToDisplay.slice(0, 800)
				}

				if (srcToDisplay) {
					span.setAttribute('target_src', srcToDisplay)
					srcToDisplay = ` src="${srcToDisplay}"`
				}

				span.setAttribute(
					'error.message',
					`Failed to load <${ev.target.tagName.toLowerCase()}${srcToDisplay} />`,
				)
			}
		}

		this.endSpanWithThrottle(span, now)
	}

	protected reportString(
		source: string,
		message: string,
		firstError: Error | undefined,
		spanContext: SpanContext,
	): void {
		if (!useful(message)) {
			return
		}

		const now = Date.now()
		const span = this.tracer.startSpan(source, { startTime: now })
		this.attachSpanContext(span, firstError ?? message, spanContext)
		span.setAttribute('component', 'error')
		span.setAttribute('error', true)
		span.setAttribute('error.object', 'String')
		span.setAttribute('error.message', limitLen(message, MESSAGE_LIMIT))
		if (firstError) {
			addStackIfUseful(span, firstError)
		}

		this.endSpanWithThrottle(span, now)
	}

	protected transform(error: InternalErrorLike, spanContext: SpanContext): ErrorWithContext | null {
		let transformedError: InternalErrorLike
		let transformedCtx: SpanContext

		try {
			let transformed: ReturnType<ErrorTransformer> = null
			context.with(suppressTracing(context.active()), () => {
				const transformer: ErrorTransformer = this._splunkConfig.onError ?? DEFAULT_ON_ERROR
				transformed = transformer(error, spanContext)
			})

			if (transformed === null) {
				return null
			}

			if (transformed === undefined) {
				diag.warn('onError can use null explicitly to cancel reporting, but cannot use undefined implicitly')
				return { context: spanContext, error }
			}

			;({ context: transformedCtx, error: transformedError } = transformed)
		} catch (e) {
			diag.warn('onError handler failed:', e)
			return { context: spanContext, error }
		}

		if (!this.isValidErrorArg(transformedError) && !Array.isArray(transformedError)) {
			diag.warn(
				`ignoring an error because onError handler was expected to produce a valid error, but instead returned: ${transformedError}`,
			)
			return { context: spanContext, error }
		}

		if (!this.isValidContext(transformedCtx)) {
			diag.warn(
				`onError handler was expected to produce a valid context (POJO), but instead returned: ${transformedCtx}`,
			)
			return { context: spanContext, error }
		}

		transformedCtx = removePropertiesWithAdvancedTypes(transformedCtx)
		return { context: transformedCtx, error: transformedError }
	}

	private attachClearingInterval(): void {
		this.clearingIntervalId = setInterval(() => {
			const callback = () => {
				this.throttleMap.forEach((relativeTime, throttleKey) => {
					if (performance.now() - relativeTime > THROTTLE_LIMIT) {
						this.throttleMap.delete(throttleKey)
					}
				})
			}

			if (typeof requestIdleCallback === 'function') {
				requestIdleCallback(callback, { timeout: 1000 })
			} else {
				callback()
			}
		}, 5000)
	}

	private attachSpanContext(span: Span, value: Error | string | Event, spanContext: SpanContext) {
		const valueWithPossibleContext = value as (Error | string | Event) & {
			splunkContext?: unknown
		}
		const contextAttributes = getValidAttributes(valueWithPossibleContext.splunkContext || {})

		const entries = Object.entries({
			...spanContext,
			...contextAttributes,
		})

		for (const [k, v] of entries) {
			span.setAttribute(k, v)
		}
	}

	private consoleErrorHandler =
		(original: Console['error']) =>
		(...args: any[]) => {
			this.report('console.error', args, {})
			return original.apply(this, args)
		}

	private documentErrorListener = (event: ErrorEvent) => {
		this.report('eventListener.error', event, {})
	}

	private endSpanWithThrottle(span: Span, endTime: number): void {
		try {
			// @ts-expect-error Attributes are defined but hidden
			const spanKey = JSON.stringify([span.attributes, span.name])
			if (
				!this.throttleMap.has(spanKey) ||
				performance.now() - (this.throttleMap.get(spanKey) || 0) > THROTTLE_LIMIT
			) {
				this.throttleMap.set(spanKey, performance.now())
				span.end(endTime)
			}
		} catch (error) {
			// If we fail to stringify attributes, just end the span without throttling
			diag.debug('Error while ending span', error)
			return
		}
	}

	private errorListener = (event: ErrorEvent) => {
		this.report('onerror', event, {})
	}

	private unhandledRejectionListener = (event: PromiseRejectionEvent) => {
		this.report('unhandledrejection', event.reason, {})
	}
}
