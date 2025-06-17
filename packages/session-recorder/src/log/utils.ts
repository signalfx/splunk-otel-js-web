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
import { log } from './logger'
import { LogLevel } from './types'

export const isLogLevel = (value: unknown): value is LogLevel =>
	['debug', 'info', 'warn', 'error'].includes(String(value))

export const createNamedLog = (logName: string) => {
	const decorateMessage = (message: string) => `${logName}: ${message}`
	return {
		...log,
		debug: (message: string, ...data: unknown[]) => {
			log.debug(decorateMessage(message), ...data)
		},
		error: (message: string, ...data: unknown[]) => {
			log.error(decorateMessage(message), ...data)
		},
		info: (message: string, ...data: unknown[]) => {
			log.info(decorateMessage(message), ...data)
		},
		warn: (message: string, ...data: unknown[]) => {
			log.warn(decorateMessage(message), ...data)
		},
	}
}
