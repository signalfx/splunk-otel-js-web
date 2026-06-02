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
import { describe, expect, it } from 'vitest'

import { QuietPeriodAwaiter } from './quiet-period-awaiter'

describe('QuietPeriodAwaiter', () => {
	it('resolves after quiet period expires', async () => {
		const awaiter = new QuietPeriodAwaiter(100)
		const resourceLoadedTimestamp = performance.now() + 10
		awaiter.startQuietTimer({ resourceLoadedTimestamp })

		const result = await awaiter.promise

		expect(result).toHaveProperty('loadTime')
		expect(result).toHaveProperty('timestampOfLastLoadedResource')
		expect(result.loadTime).toBe(10)
		expect(result.timestampOfLastLoadedResource).toBe(resourceLoadedTimestamp)
	})

	it('resets timer when removeQuietTimer is called', async () => {
		const awaiter = new QuietPeriodAwaiter(500)
		awaiter.startQuietTimer({ resourceLoadedTimestamp: performance.now() })

		await new Promise((resolve) => setTimeout(resolve, 250))
		awaiter.removeQuietTimer()
		const resourceLoadedTimestamp = performance.now()
		awaiter.startQuietTimer({ resourceLoadedTimestamp })

		const result = await awaiter.promise
		expect(result.loadTime).toBeGreaterThanOrEqual(250)
		expect(result.loadTime).toBeLessThan(300)
	})

	it('complete() resolves immediately', async () => {
		const awaiter = new QuietPeriodAwaiter(1000)

		awaiter.complete({ areResourcesStillLoading: false })
		const result = await awaiter.promise
		expect(result.loadTime).toBe(0)
	})
})
