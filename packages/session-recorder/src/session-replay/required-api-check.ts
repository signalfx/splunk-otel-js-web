/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
export const isRequiredAPISupported = () =>
	![
		window.queueMicrotask,
		Array.from,
		Array.prototype && Array.prototype.find,
		Array.prototype && Array.prototype.findIndex,
		Array.prototype && Array.prototype.flat,
		Array.prototype && Array.prototype.flatMap,
		Array.prototype && Array.prototype.includes,
		Element.prototype && Element.prototype.append,
		Event.prototype && Event.prototype.composedPath,
		'getRootNode' in (Node.prototype || {}),
		'isConnected' in (Node.prototype || {}),
		Object.assign,
		Object.entries,
		Object.fromEntries,
		// @ts-expect-error Expected
		Object.hasOwn,
		Object.setPrototypeOf,
		Object.values,
		String.prototype.includes,
		String.prototype.endsWith,
		String.prototype.startsWith,
		window.fetch,
		window.AbortController,
		window.MessageChannel,
		window.MessagePort,
		window.navigator && window.navigator.sendBeacon,
		window.requestIdleCallback,
		// @ts-expect-error Expected
		window.Promise && window.Promise.any,
		window.Promise && window.Promise.allSettled,
		window.ResizeObserver,
		window.Symbol && window.Symbol.asyncIterator,
		window.Reflect,
		window.Uint8Array.prototype.reduce,
		typeof globalThis !== 'undefined',
	]
		.map(Boolean)
		.includes(false)
