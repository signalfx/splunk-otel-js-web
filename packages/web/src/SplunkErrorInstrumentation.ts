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

import * as shimmer from 'shimmer'
import { getElementXPath } from '@opentelemetry/sdk-trace-web'
import { limitLen } from './utils'
import { Span } from '@opentelemetry/api'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'

// FIXME take timestamps from events?

const STACK_LIMIT = 4096
const MESSAGE_LIMIT = 1024

export const STACK_TRACE_URL_PATTER = /([\w]+:\/\/[^\s/]+\/[^\s?:#]+)/g

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
		//get sourcemap ids and add to span as error.soruce_map_ids
		span.setAttribute('error.stack', limitLen(err.stack.toString(), STACK_LIMIT))
		const sourcemapIds = parseErrorStack(err.stack)
		if (sourcemapIds) {
			span.setAttribute('error.source_map_ids', sourcemapIds)
		}
	}
}

export const ERROR_INSTRUMENTATION_NAME = 'errors'
export const ERROR_INSTRUMENTATION_VERSION = '1'

export class SplunkErrorInstrumentation extends InstrumentationBase {
	constructor(config: InstrumentationConfig) {
		super(ERROR_INSTRUMENTATION_NAME, ERROR_INSTRUMENTATION_VERSION, config)
	}

	disable(): void {
		shimmer.unwrap(console, 'error')
		window.removeEventListener('unhandledrejection', this._unhandledRejectionListener)
		window.removeEventListener('error', this._errorListener)
		document.documentElement.removeEventListener('error', this._documentErrorListener, { capture: true })
	}

	enable(): void {
		shimmer.wrap(console, 'error', this._consoleErrorHandler)
		window.addEventListener('unhandledrejection', this._unhandledRejectionListener)
		window.addEventListener('error', this._errorListener)
		document.documentElement.addEventListener('error', this._documentErrorListener, { capture: true })
	}

	init(): void {}

	public report(source: string, arg: string | Event | ErrorEvent | Array<any>): void {
		if (Array.isArray(arg) && arg.length === 0) {
			return
		}

		if (arg instanceof Array && arg.length === 1) {
			arg = arg[0]
		}

		if (arg instanceof Error) {
			this.reportError(source, arg)
		} else if (arg instanceof ErrorEvent) {
			this.reportErrorEvent(source, arg)
		} else if (arg instanceof Event) {
			this.reportEvent(source, arg)
		} else if (typeof arg === 'string') {
			this.reportString(source, arg)
		} else if (arg instanceof Array) {
			// if any arguments are Errors then add the stack trace even though the message is handled differently
			const firstError = arg.find((x) => x instanceof Error)
			this.reportString(source, arg.map((x) => stringifyValue(x)).join(' '), firstError)
		} else {
			this.reportString(source, stringifyValue(arg)) // FIXME or JSON.stringify?
		}
	}

	protected reportError(source: string, err: Error): void {
		const msg = err.message || err.toString()
		if (!useful(msg) && !err.stack) {
			return
		}

		const now = Date.now()
		const span = this.tracer.startSpan(source, { startTime: now })
		span.setAttribute('component', 'error')
		span.setAttribute('error', true)
		span.setAttribute(
			'error.object',
			useful(err.name) ? err.name : err.constructor && err.constructor.name ? err.constructor.name : 'Error',
		)
		span.setAttribute('error.message', limitLen(msg, MESSAGE_LIMIT))
		addStackIfUseful(span, err)
		span.end(now)
	}

	protected reportErrorEvent(source: string, ev: ErrorEvent): void {
		if (ev.error) {
			this.report(source, ev.error)
		} else if (ev.message) {
			this.report(source, ev.message)
		}
	}

	protected reportEvent(source: string, ev: Event): void {
		// FIXME consider other sources of global 'error' DOM callback - what else can be captured here?
		if (!ev.target && !useful(ev.type)) {
			return
		}

		const now = Date.now()
		const span = this.tracer.startSpan(source, { startTime: now })
		span.setAttribute('component', 'error')
		span.setAttribute('error.type', ev.type)
		if (ev.target) {
			// TODO: find types to match this
			span.setAttribute('target_element', (ev.target as any).tagName)
			span.setAttribute('target_xpath', getElementXPath(ev.target, true))
			span.setAttribute('target_src', (ev.target as any).src)
		}

		span.end(now)
	}

	protected reportString(source: string, message: string, firstError?: Error): void {
		if (!useful(message)) {
			return
		}

		const now = Date.now()
		const span = this.tracer.startSpan(source, { startTime: now })
		span.setAttribute('component', 'error')
		span.setAttribute('error', true)
		span.setAttribute('error.object', 'String')
		span.setAttribute('error.message', limitLen(message, MESSAGE_LIMIT))
		if (firstError) {
			addStackIfUseful(span, firstError)
		}

		span.end(now)
	}

	private readonly _consoleErrorHandler =
		(original: Console['error']) =>
		(...args: any[]) => {
			this.report('console.error', args)
			return original.apply(this, args)
		}

	private readonly _documentErrorListener = (event: ErrorEvent) => {
		this.report('eventListener.error', event)
	}

	private readonly _errorListener = (event: ErrorEvent) => {
		this.report('onerror', event)
	}

	private readonly _unhandledRejectionListener = (event: PromiseRejectionEvent) => {
		this.report('unhandledrejection', event.reason)
	}
}
