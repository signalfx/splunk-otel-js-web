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

import { SESSION_INACTIVITY_TIMEOUT_MS } from '../session-manager'

export const SESSION_STORAGE_KEY = '_splunk_rum_sid'
export const SESSION_EXPIRATION_COOKIE_SEC = SESSION_INACTIVITY_TIMEOUT_MS / 1000

export const ANONYMOUS_USER_ID_STORAGE_KEY = '_splunk_rum_user_anonymousId'
export const ANONYMOUS_USER_ID_EXPIRATION_SEC = 60 * 60 * 24 * 400
