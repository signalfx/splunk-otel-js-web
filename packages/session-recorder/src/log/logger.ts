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
import { LogLevel, LogLevelNumber, LogSource, MiddlewareFunction } from './types'

const GROUP_INTERVAL = 1000

class Logger {
	private groupLoggingIntervalId: number | null = null

	private groupsByKey = new Map<string, Array<[logLevel: LogLevel, ...data: unknown[]]>>()

	private isGroupLoggingEnabled: boolean = false

	private loggingLevel: LogLevelNumber | null = null

	private loggingPrefix: string = ''

	private readonly middlewares: MiddlewareFunction[] = []

	constructor() {}

	critical = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('console', 'critical', message, ...data)
		if (this.loggingLevel !== null && LogLevelNumber.CRITICAL >= this.loggingLevel) {
			console.error(`${this.loggingPrefix}${message}`, ...data)
		}
	}

	debug = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('console', 'debug', message, ...data)

		if (this.loggingLevel !== null && LogLevelNumber.DEBUG >= this.loggingLevel) {
			console.debug(`${this.loggingPrefix}${message}`, ...data)
		}
	}

	debugGroup = (groupKey: string, ...data: unknown[]): void => {
		if (!this.isGroupLoggingEnabled) {
			this.debug(groupKey, ...data)
			return
		}

		if (this.loggingLevel !== null && LogLevelNumber.DEBUG >= this.loggingLevel) {
			this.pushToGroup('debug', groupKey, ...data)
		}
	}

	debugNoConsole = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('internal', 'debug', message, ...data)
	}

	enableGroupLogging = () => {
		this.isGroupLoggingEnabled = true

		if (this.groupLoggingIntervalId !== null) {
			this.groupLoggingIntervalId = window.setInterval(() => {
				const currentGroups = this.groupsByKey
				this.groupsByKey = new Map()

				for (const [groupKey, logData] of currentGroups.entries()) {
					console.groupCollapsed(groupKey)
					for (const [level, ...data] of logData) {
						if (level === 'critical') {
							console.error(...data)
						} else {
							console[level](...data)
						}
					}

					console.groupEnd()
				}
			}, GROUP_INTERVAL)
		}
	}

	error = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('console', 'error', message, ...data)
		if (this.loggingLevel !== null && LogLevelNumber.ERROR >= this.loggingLevel) {
			console.error(`${this.loggingPrefix}${message}`, ...data)
		}
	}

	errorGroup = (groupKey: string, ...data: unknown[]): void => {
		if (!this.isGroupLoggingEnabled) {
			this.error(groupKey, ...data)
			return
		}

		if (this.loggingLevel !== null && LogLevelNumber.ERROR >= this.loggingLevel) {
			this.pushToGroup('error', groupKey, ...data)
		}
	}

	errorNoConsole = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('internal', 'error', message, ...data)
	}

	info = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('console', 'info', message, ...data)
		if (this.loggingLevel !== null && LogLevelNumber.INFO >= this.loggingLevel) {
			console.log(`${this.loggingPrefix}${message}`, ...data)
		}
	}

	infoGroup = (groupKey: string, ...data: unknown[]): void => {
		if (!this.isGroupLoggingEnabled) {
			this.info(groupKey, ...data)
			return
		}

		if (this.loggingLevel !== null && LogLevelNumber.INFO >= this.loggingLevel) {
			this.pushToGroup('info', groupKey, ...data)
		}
	}

	infoNoConsole = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('internal', 'info', message, ...data)
	}

	setLoggingLevel = (level: LogLevel): void => {
		this.loggingLevel = Logger.convertLogLevelToNumber(level)
	}

	setLoggingPrefix = (prefix: string): void => {
		this.loggingPrefix = prefix
	}

	setMiddleware = (middlewareFunction: MiddlewareFunction): void => {
		this.middlewares.push(middlewareFunction)
	}

	warn = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('console', 'warn', message, ...data)
		if (this.loggingLevel !== null && LogLevelNumber.WARN >= this.loggingLevel) {
			console.warn(`${this.loggingPrefix}${message}`, ...data)
		}
	}

	warnGroup = (groupKey: string, ...data: unknown[]): void => {
		if (!this.isGroupLoggingEnabled) {
			this.warn(groupKey, ...data)
			return
		}

		if (this.loggingLevel !== null && LogLevelNumber.WARN >= this.loggingLevel) {
			this.pushToGroup('warn', groupKey, ...data)
		}
	}

	warnNoConsole = (message: string, ...data: unknown[]): void => {
		this.processMiddlewares('internal', 'warn', message, ...data)
	}

	private static convertLogLevelToNumber = (level: LogLevel): LogLevelNumber => {
		switch (level) {
			case 'debug': {
				return LogLevelNumber.DEBUG
			}
			case 'info': {
				return LogLevelNumber.INFO
			}
			case 'warn': {
				return LogLevelNumber.WARN
			}
			case 'error': {
				return LogLevelNumber.ERROR
			}
			case 'critical': {
				return LogLevelNumber.CRITICAL
			}
			default: {
				return LogLevelNumber.ERROR
			}
		}
	}

	private processMiddlewares = (source: LogSource, logLevel: LogLevel, message: string, ...data: unknown[]) => {
		this.middlewares.forEach((middleware) => middleware(source, logLevel, message, ...data))
	}

	private pushToGroup(logLevel: LogLevel, groupName: string, ...data: unknown[]): void {
		let group = this.groupsByKey.get(groupName)
		if (!group) {
			group = []
			this.groupsByKey.set(groupName, group)
		}

		group.push([logLevel, ...data])
	}
}

export const log = new Logger()
