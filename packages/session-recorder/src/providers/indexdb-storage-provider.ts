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

import { log } from '../log'
import { QueuedLog } from '../types'

const DATABASE_NAME = 'splunk_otel_internal_db'
// By updating this number you need to handle the migration in onupgradeneeded event
const DATABASE_VERSION = 1
const LOG_STORE_NAME = 'session_replay_logs'
const MAX_NUMBER_OF_STORED_SESSION_REPLAY_LOGS = 2000

// Browser can close the database unexpectedly (at least we could not find the reason),
// we will try to reopen it up to this number of times
const MAX_IDB_REOPEN_ATTEMPTS = 5

class IDBStorageProvider {
	private database: IDBDatabase | null = null

	private initializeDatabasePromise: Promise<IDBDatabase> | null = null

	private isDatabaseClosed = false

	private numberOfUnexpectedCloses = 0

	clearLogStore = async () => {
		await this.initializeIfNeeded()

		if (this.isDatabaseClosed) {
			return
		}

		try {
			await new Promise<void>((resolve, reject) => {
				if (!this.database) {
					reject(new Error('IndexDB: Database not initialized'))
					return
				}

				if (!this.database.objectStoreNames.contains(LOG_STORE_NAME)) {
					resolve()
					return
				}

				const transaction = this.database.transaction(LOG_STORE_NAME, 'readwrite')
				const store = transaction.objectStore(LOG_STORE_NAME)
				const request = store.clear()

				request.addEventListener('success', (event) => {
					log.debug('Success clearing log store', event)
					resolve()
				})

				request.addEventListener('error', (event) => {
					log.debug('Error clearing log store', event)
					reject(new Error('Error clearing store'))
				})
			})
		} catch (error) {
			log.debug('Error clearing log store', error)
		}
	}

	clearStorage = async () => {
		await this.clearLogStore()
	}

	getStoredLogs = async (): Promise<QueuedLog[] | null> => {
		await this.initializeIfNeeded()

		if (this.isDatabaseClosed) {
			return null
		}

		try {
			return await new Promise<QueuedLog[] | null>((resolve, reject) => {
				if (!this.database) {
					reject(new Error('IndexDB: Database not initialized'))
					return
				}

				if (!this.database.objectStoreNames.contains(LOG_STORE_NAME)) {
					resolve(null)
					return
				}

				const transaction = this.database.transaction(LOG_STORE_NAME, 'readonly')
				const store = transaction.objectStore(LOG_STORE_NAME)
				const request = store.getAll() as IDBRequest<QueuedLog[] | null>

				request.addEventListener('success', () => {
					log.debug('Success reading log data', request.result)
					resolve(request.result)
				})

				request.addEventListener('error', (event) => {
					log.debug('Error reading log data', event)
					reject(new Error('IndexDB: Error reading data'))
				})
			})
		} catch (error) {
			log.debug('Error reading log data', error)
			return null
		}
	}

	removeLog = async (requestId: string): Promise<boolean> => {
		await this.initializeIfNeeded()

		if (this.isDatabaseClosed) {
			return false
		}

		if (!this.database) {
			return false
		}

		if (!this.database.objectStoreNames.contains(LOG_STORE_NAME)) {
			return false
		}

		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = this.database?.transaction(LOG_STORE_NAME, 'readwrite')
				const store = transaction?.objectStore(LOG_STORE_NAME)
				const request = store?.delete(requestId)

				request?.addEventListener('success', (event) => {
					log.debug('Success removing log data', event)
					resolve()
				})

				request?.addEventListener('error', (event) => {
					log.debug('Error removing log data', event)
					reject(new Error('IndexDB: Error removing data'))
				})
			})

			return true
		} catch (error) {
			log.debug('Error removing log data', error)
			return false
		}
	}

	storeLog = async (queuedLog: QueuedLog) => {
		await this.initializeIfNeeded()

		if (this.isDatabaseClosed) {
			return false
		}

		if (!this.database) {
			return false
		}

		if (!this.database.objectStoreNames.contains(LOG_STORE_NAME)) {
			return false
		}

		if ((await this.getNumberOfStoredLogs()) >= MAX_NUMBER_OF_STORED_SESSION_REPLAY_LOGS) {
			log.debug('Max number of stored logs reached. Log will not be stored.')
			return false
		}

		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = this.database?.transaction(LOG_STORE_NAME, 'readwrite')
				const store = transaction?.objectStore(LOG_STORE_NAME)
				const request = store?.put(queuedLog)

				request?.addEventListener('success', (event) => {
					log.debug('Success writing log data', event)
					resolve()
				})

				request?.addEventListener('error', (event) => {
					log.debug('Error writing log data', event)

					if (request.error?.name === 'QuotaExceededError') {
						log.debug(
							'QuotaExceededError occurred while writing data. Log will not be stored and store will be cleared.',
						)
						void this.clearLogStore()
					}

					reject(new Error('IndexDB: Error writing data'))
				})
			})

			return true
		} catch (error) {
			log.debug('Error writing log data', error)
			return false
		}
	}

	private getNumberOfStoredLogs = async (): Promise<number> => {
		await this.initializeIfNeeded()

		if (this.isDatabaseClosed) {
			return 0
		}

		try {
			return await new Promise<number>((resolve, reject) => {
				if (!this.database) {
					reject(new Error('IndexDB: Database not initialized'))
					return
				}

				if (!this.database.objectStoreNames.contains(LOG_STORE_NAME)) {
					resolve(0)
					return
				}

				const transaction = this.database.transaction(LOG_STORE_NAME, 'readonly')
				const store = transaction.objectStore(LOG_STORE_NAME)
				const request = store.count()

				request.addEventListener('success', () => {
					log.debug('Success reading log store size', request.result)
					resolve(request.result)
				})

				request.addEventListener('error', (event) => {
					log.debug('Error reading log store size', event)
					reject(new Error('IndexDB: Error reading store size'))
				})
			})
		} catch (error) {
			log.debug('Error reading log store size', error)
			return 0
		}
	}

	private async initializeIfNeeded() {
		if (this.numberOfUnexpectedCloses > MAX_IDB_REOPEN_ATTEMPTS || this.isDatabaseClosed) {
			this.isDatabaseClosed = true
			return
		}

		if (this.database) {
			return
		}

		if (this.initializeDatabasePromise) {
			try {
				this.database = await this.initializeDatabasePromise
			} catch {
				this.isDatabaseClosed = true
			}

			return
		}

		this.initializeDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

			request.addEventListener('error', (event) => {
				log.debug('Error occurred while opening IndexedDB database. IndexedDB is not available.', event)
				reject(
					new Error('IndexDB: Error occurred while opening IndexedDB database. IndexedDB is not available.'),
				)
			})

			request.addEventListener('success', (event) => {
				log.debug('IndexedDB database opened successfully.', event)

				const db = request.result
				db.addEventListener('close', () => {
					this.numberOfUnexpectedCloses += 1
					this.database = null
					this.initializeDatabasePromise = null
				})
				resolve(db)
			})

			request.addEventListener('upgradeneeded', (event) => {
				log.debug('IndexedDB database upgrade needed.', event)
				const db = request.result
				if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
					db.createObjectStore(LOG_STORE_NAME, { keyPath: 'requestId' })
				}
			})
		})

		try {
			this.database = await this.initializeDatabasePromise
		} catch {
			this.isDatabaseClosed = true
			return
		}
	}
}

export const indexDBStorageProvider = new IDBStorageProvider()
