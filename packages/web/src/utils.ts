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

import { wrap } from 'shimmer'

export function generateId(bits: number): string {
	const xes = 'x'.repeat(bits / 4)
	return xes.replace(/x/g, function () {
		return ((Math.random() * 16) | 0).toString(16)
	})
}

export function limitLen(s: string, cap: number): string {
	if (s.length > cap) {
		return s.substring(0, cap)
	} else {
		return s
	}
}

/**
 * Get plugin config from user provided value
 *
 * @template {Object|undefined} T
 * @param value Value given by user
 * @param defaults Default value
 * @param defaultDisable If undefined by user should mean false
 */
export function getPluginConfig<T>(
	value: T | boolean | undefined,
	defaults?: T,
	defaultDisable?: T | boolean,
): false | T {
	if (value === false) {
		return value
	}

	if (value === undefined && defaultDisable) {
		return false
	}

	return Object.assign({}, defaults, value)
}

/**
 * Type guard that checks if value is function (and acts as user-defined type guard)
 *
 * @param value Value to check
 * @returns is function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
	return typeof value === 'function'
}

export function isIframe(): boolean {
	try {
		return window.self !== window.top
	} catch {
		return true
	}
}

/**
 * Wrap function while keeping the toString calling the original as some frameworks
 * use it to determine if the function's native or polyfilled
 *
 * Example:
 * https://github.com/vuejs/vue/blob/0603ff695d2f41286239298210113cbe2b209e28/src/core/util/env.js#L58
 * https://github.com/vuejs/vue/blob/0603ff695d2f41286239298210113cbe2b209e28/src/core/util/next-tick.js#L42
 *
 * @param nodule Target object
 * @param name Property to patch
 * @param wrapper Wrapper
 */
export function wrapNatively<Nodule extends object, FieldName extends keyof Nodule>(
	nodule: Nodule,
	name: FieldName,
	wrapper: (original: Nodule[FieldName]) => Nodule[FieldName],
): void {
	const orig = nodule[name] as Nodule[FieldName] & { toString?: () => string }
	wrap(nodule, name, wrapper)
	const wrapped = nodule[name] as Nodule[FieldName] & { toString?: () => string }
	if (orig.toString) {
		wrapped.toString = orig.toString.bind(orig)
	}
}

/**
 * Get the original version of function (without all of the shimmer wrappings)
 */
export function getOriginalFunction<T extends CallableFunction>(func: T): T {
	// @ts-expect-error __original isn't mentioned in types
	while (func.__original && func.__original !== func) {
		// @ts-expect-error same
		func = func.__original as T
	}

	return func
}

/**
 * Wait for a variable to be set globally
 *
 * @param {string} identifier Name of the variable (window[identifier])
 * @param {function} callback Fired when such value is available
 * @returns {function} cleanup to call in disable (in case not defined before instrumentation is disabled)
 */
export function waitForGlobal<T = unknown>(identifier: string, callback: (value: T) => void): () => void {
	const windowWithDynamicProps = window as unknown as Window & { [key: string]: T }

	if (windowWithDynamicProps[identifier]) {
		callback(windowWithDynamicProps[identifier])
		return () => {}
	}

	const value = windowWithDynamicProps[identifier]
	let used = false
	Object.defineProperty(window, identifier, {
		get() {
			return value
		},
		set(newVal) {
			delete windowWithDynamicProps[identifier]
			used = true
			windowWithDynamicProps[identifier] = newVal
			callback(newVal)
		},
		configurable: true,
		enumerable: false,
	})

	return () => {
		// Don't touch if value is used or another defineProperty used it
		if (used || windowWithDynamicProps[identifier] !== value) {
			return
		}

		delete (window as any)[identifier]
		if (value !== undefined) {
			windowWithDynamicProps[identifier] = value
		}
	}
}
