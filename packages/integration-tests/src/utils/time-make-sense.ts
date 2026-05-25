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
import type { TimedEvent } from '@opentelemetry/sdk-trace-base'
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
import { expect } from '@playwright/test'

function hrTimeToNanos(time: [number, number]): bigint {
	return BigInt(time[0]) * 1_000_000_000n + BigInt(time[1])
}

export const timesMakeSense = (events: TimedEvent[], startName: string, endName: string) => {
	const eventsObject: Record<string, bigint> = {}
	events.forEach((event) => {
		eventsObject[event.name] = hrTimeToNanos(event.time)
	})

	expect(eventsObject[startName]).toBeTruthy()
	expect(eventsObject[endName]).toBeTruthy()

	expect(eventsObject[startName]).toBeLessThanOrEqual(eventsObject[endName])

	const diff = eventsObject[endName] - eventsObject[startName]
	const fiveMinutesNanos = BigInt(5 * 60 * 1000 * 1000) * 1000n

	// Sanity check for time difference
	expect(diff).toBeLessThanOrEqual(fiveMinutesNanos)

	// Also looking for rough synchronization with reality (at least from our CI systems/laptops...)
	const nowNanos = BigInt(Date.now()) * 1_000_000n
	let clockSkew = eventsObject[startName] - nowNanos
	if (clockSkew < 0n) {
		clockSkew = -clockSkew
	}

	// Sanity check for clock skew
	expect(clockSkew).toBeLessThanOrEqual(fiveMinutesNanos)
}
