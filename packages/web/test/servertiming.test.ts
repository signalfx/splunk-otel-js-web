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
import { captureTraceParent, captureTraceParentFromPerformanceEntries } from '../src/servertiming'

describe('test captureTraceParent', () => {
	it('should deal with simple value', () => {
		const span = {
			setAttribute: function (k, v) {
				this[k] = v
			},
		}
		// TODO: start an actual span
		captureTraceParent('traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01"', span as any)
		assert.strictEqual('000000000000000078499d3266d75d5f', span['link.traceId'])
		assert.strictEqual('7e1c10b3c482edbe', span['link.spanId'])
	})
	it('should deal with multiple values', () => {
		const span = {
			setAttribute: function (k, v) {
				this[k] = v
			},
		}
		// TODO: start an actual span
		captureTraceParent(
			'other;dur=1234, traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01",misc;desc="stuff"',
			span as any,
		)
		assert.strictEqual('000000000000000078499d3266d75d5f', span['link.traceId'])
		assert.strictEqual('7e1c10b3c482edbe', span['link.spanId'])
	})
	it('should deal with single quotes', () => {
		const span = {
			setAttribute: function (k, v) {
				this[k] = v
			},
		}
		// TODO: start an actual span
		captureTraceParent("traceparent;desc='00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01'", span as any)
		assert.strictEqual('000000000000000078499d3266d75d5f', span['link.traceId'])
		assert.strictEqual('7e1c10b3c482edbe', span['link.spanId'])
	})
})

describe('test captureTraceParentFromPerformanceEntries', () => {
	it('should handle absence of serverTiming', () => {
		const entries = {}
		const span = {
			setAttribute: function (k, v) {
				this[k] = v
			},
		}
		// TODO: start an actual span
		captureTraceParentFromPerformanceEntries(entries, span as any)
		assert.ok(span['link.traceId'] === undefined)
	})
	it('should deal with multiple entries', () => {
		const entries = {
			serverTiming: [
				{ name: 'nomatch' },
				{ name: 'traceparent', description: '00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01' },
			],
		}
		const span = {
			setAttribute: function (k, v) {
				this[k] = v
			},
		}
		// TODO: start an actual span
		captureTraceParentFromPerformanceEntries(entries as any, span as any)
		assert.strictEqual('000000000000000078499d3266d75d5f', span['link.traceId'])
		assert.strictEqual('7e1c10b3c482edbe', span['link.spanId'])
	})
})
