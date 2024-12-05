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
import { hasNativeSessionId } from './utils'
import { StorageService } from '../storage-service'
import { Session } from './session'
import { ActivityService } from '../activity-service'
import { InternalEventTarget } from '../../EventTarget'
import { SplunkOtelWebConfig, SessionId, SessionDataWithMeta } from '../../types'
import { generateId } from '../../utils'
import { SESSION_INACTIVITY_TIMEOUT_MS } from './constants'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { SessionSpanProcessor } from './session-span-processor'
import { SessionProvider } from './session-provider'

export class SessionService {
	private hasRecentActivity = false

	constructor(
		private readonly config: SplunkOtelWebConfig,
		private readonly provider: WebTracerProvider,
		private readonly storageService: StorageService,
		private readonly activityService: ActivityService,
		private readonly eventTarget: InternalEventTarget,
	) {}

	checkSession = (initialSessionId?: SessionId) => {
		const sessionData = this.getOrCreateSessionData(initialSessionId)
		SessionProvider.setSession(new Session(sessionData))

		if (sessionData.isNewSession) {
			this.hasRecentActivity = true
		}

		this.eventTarget.emit('session-changed', { sessionId: SessionProvider.sessionId })

		if (this.hasRecentActivity) {
			sessionData.expiresAt = Date.now() + SESSION_INACTIVITY_TIMEOUT_MS
			SessionProvider.updateSession(sessionData)
			this.storageService.setSessionData(sessionData)
		}

		this.hasRecentActivity = false
	}

	startSession = (initialSessionId?: SessionId) => {
		if (SessionProvider.getSession()) {
			throw new Error('Session already running')
		}

		if (hasNativeSessionId()) {
			return
		}

		this.markActivity()
		this.activityService.start(this.markActivity)
		this.provider.addSpanProcessor(new SessionSpanProcessor(this.onSessionSpanStart))

		this.checkSession(initialSessionId)
	}

	stopSession = () => {
		if (!SessionProvider.getSession()) {
			throw new Error('No session running')
		}

		this.activityService.stop()
		SessionProvider.clearSession()
	}

	private getOrCreateSessionData = (initialSessionId?: SessionId): SessionDataWithMeta => {
		const sessionData = this.storageService.getSessionData()
		if (sessionData) {
			return sessionData
		}

		return {
			id: initialSessionId ?? generateId(128),
			startTime: Date.now(),
			expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
			isNewSession: true,
		}
	}

	private markActivity = () => {
		this.hasRecentActivity = true
	}

	private onSessionSpanStart = () => {
		if (this.config._experimental_allSpansExtendSession) {
			this.markActivity()
		}

		this.checkSession()
	}
}
