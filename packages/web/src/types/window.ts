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
declare global {
	interface Window {
		SplunkRumNative?: {
			getNativeSessionId: () => string
		}
		__splunkRumIntegrationTestSessionId?: string
	}

	interface Navigator {
		readonly userAgentData?: {
			mobile?: boolean
			platform?: string
			getHighEntropyValues(hints: string[]): Promise<
				| {
						architecture?: string
						bitness?: string
						brands?: Array<{
							brand: string
							version: string
						}>
						fullVersionList?: Array<{
							brand: string
							version: string
						}>
						mobile?: boolean
						model?: string
						platform?: string
						platformVersion?: string
						uaFullVersion?: string
						wow64?: boolean
				  }
				| undefined
			>
		}
	}
}

// eslint-disable-next-line
export {}
