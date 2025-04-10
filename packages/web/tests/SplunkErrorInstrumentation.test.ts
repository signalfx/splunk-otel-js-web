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

import { STACK_TRACE_URL_PATTER } from '../src/SplunkErrorInstrumentation'
import { describe, it, expect, beforeEach } from 'vitest'

export function generateFilePaths(domainCount: number, pathCount: number): string[] {
	const paths: string[] = []
	for (let i = 0; i < domainCount; i++) {
		const domain = `http://domain${i}.com`
		for (let j = 0; j < pathCount; j++) {
			paths.push(`${domain}/path${j}.js`)
		}
	}
	return paths
}

export function generateRandomStackTrace(paths: string[], stackCount: number): string {
	let stack = 'Error\n'
	for (let i = 0; i < stackCount; i++) {
		stack += `at ${paths[Math.floor(Math.random() * paths.length)]}:${Math.floor(Math.random() * 1000)}:${Math.floor(Math.random() * 1000)}\n`
	}
	return stack
}

const chromeStackTraceEval = `Error: Something went wrong
    at eval (eval at <anonymous> (http://example.com/scripts/main.js:10:20), <anonymous>:1:1)
    at Object.functionName (http://example.com/scripts/utils.js:15:25)
    at http://example.com/scripts/app.js:20:30
    at new ConstructorName (http://example.com/scripts/controller.js:25:35)
    at http://example.com/scripts/main.js:30:40`

const chromeStackTraceEvalExpected = [
	'http://example.com/scripts/main.js',
	'http://example.com/scripts/utils.js',
	'http://example.com/scripts/app.js',
	'http://example.com/scripts/controller.js',
]

const chromeStackTraceAnonymous = `TypeError: undefined is not a function
    at http://example.com/js/anonymous.js:10:5
    at <anonymous>:15:10
    at Object.functionName (http://example.com/js/utils.js:20:15)
    at new ConstructorName (http://example.com/js/app.js:25:20)
    at <anonymous>:30:25`

const chromeStackTraceAnonymousExpected = [
	'http://example.com/js/anonymous.js',
	'http://example.com/js/utils.js',
	'http://example.com/js/app.js',
]

const geckoStackTraceEval = `Error: Something went wrong
    @http://example.com/scripts/main.js:10:20
    @eval (eval at <anonymous>:1:1)
    functionName@http://example.com/scripts/utils.js:15:25
    @http://example.com/scripts/app.js:20:30
    ConstructorName@http://example.com/scripts/controller.js:25:35
    @http://example.com/scripts/main.js:30:40`

const geckoStackTraceEvalExpected = [
	'http://example.com/scripts/main.js',
	'http://example.com/scripts/utils.js',
	'http://example.com/scripts/app.js',
	'http://example.com/scripts/controller.js',
]

const geckoStackTraceAnonymous = `TypeError: undefined is not a function
    @http://example.com/js/anonymous.js:10:5
    @<anonymous>:15:10
    functionName@http://example.com/js/utils.js:20:15
    ConstructorName@http://example.com/js/app.js:25:20
    @<anonymous>:30:25`

const geckoStackTraceAnonymousExpected = [
	'http://example.com/js/anonymous.js',
	'http://example.com/js/utils.js',
	'http://example.com/js/app.js',
]

// Test 1: simple test w/ dupes
const stack1 = `Error
    at http://localhost:8080/js/script1.js:10:15
    at http://localhost:8080/js/script2.js:20:25
    at http://localhost:8080/js/script1.js:30:35`
const expected1 = ['http://localhost:8080/js/script1.js', 'http://localhost:8080/js/script2.js']

// Test 2: http and https
const stack2 = `Error
    at https://example.com/js/app.js:50:10
    at http://localhost/js/util.js:100:50`
const expected2 = ['https://example.com/js/app.js', 'http://localhost/js/util.js']

// Test 3: No full path URLs
const stack3 = `Error
    at someFunction (file.js:10:15)
    at anotherFunction (file.js:20:25)`
const expected3: string[] = []

// Test 4: Only one URL, with port
const stack4 = `Error
    at http://localhost:3000/js/main.js:10:15`
const expected4 = ['http://localhost:3000/js/main.js']

// Test 5: Duplicate URLs
const stack5 = `Error
    at http://localhost:3000/js/main.js:10:15
    at http://localhost:3000/js/main.js:20:25
    at http://localhost:3000/js/utils.js:30:35`
const expected5 = ['http://localhost:3000/js/main.js', 'http://localhost:3000/js/utils.js']

// Test 6: Urls with query strings and fragments
const stack6 = `Error
    at http://example.com:8080/path/js/main.js?name=testname:10:15
    at http://example.com:8080/path/js/main2.js#fragmentHere:20:15
    at http://example.com:8080/path/js/main3.js?name=testname#fragmentHere:30:15`
const expected6 = [
	'http://example.com:8080/path/js/main.js',
	'http://example.com:8080/path/js/main2.js',
	'http://example.com:8080/path/js/main3.js',
]

// Test 7: Urls with different protocols and blobs
const stack7 = `Error
    at file://testing.com:8000/js/testFile.js:1:2
    at blob:https://example.com:1000/src/hello.js:2:3`
const expected7 = ['file://testing.com:8000/js/testFile.js', 'https://example.com:1000/src/hello.js']

describe('SplunkErrorInstrumentation', () => {
	let urls = new Set()
	let match

	beforeEach(() => {
		urls = new Set()
		match = null
	})

	it('should test chrome eval stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(chromeStackTraceEval)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(chromeStackTraceEvalExpected)
	})

	it('should test chrome anonymous stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(chromeStackTraceAnonymous)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(chromeStackTraceAnonymousExpected)
	})

	it('should test gecko eval stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(geckoStackTraceEval)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(geckoStackTraceEvalExpected)
	})

	it('should test gecko anonymous stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(geckoStackTraceAnonymous)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(geckoStackTraceAnonymousExpected)
	})

	it('should test simple stack trace with dupes', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(stack1)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(expected1)
	})

	it('should test http vs https stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(stack2)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(expected2)
	})

	it('should test no full url path stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(stack3)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(expected3)
	})

	it('should test url ports in stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(stack4)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(expected4)
	})

	it('should test duplicate urls in stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(stack5)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(expected5)
	})

	it('should test query strings/fragments in stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(stack6)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(expected6)
	})

	it('should test blobs and diff protocols in stack traces', () => {
		while ((match = STACK_TRACE_URL_PATTER.exec(stack7)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr).toStrictEqual(expected7)
	})

	it('should test long stack traces', () => {
		const randomPaths = generateFilePaths(20, 20)
		const randomStack = generateRandomStackTrace(randomPaths, 10000)

		while ((match = STACK_TRACE_URL_PATTER.exec(randomStack)) !== null) {
			urls.add(match[0])
		}
		const urlArr = [...urls]
		expect(urlArr.sort()).toStrictEqual(randomPaths.sort())
	})
})
