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
const SESSION_REPLAY_VERSION_TAG = 'v1.30.0'
const SESSION_REPLAY_CDN_BASE_URL = `https://cdn.signalfx.com/o11y-gdi-rum/session-replay/${SESSION_REPLAY_VERSION_TAG}`

export const SESSION_REPLAY_BROWSER_SCRIPT_URL = `${SESSION_REPLAY_CDN_BASE_URL}/session-replay.browser.min.js`
export const SESSION_REPLAY_BROWSER_LEGACY_SCRIPT_URL = `${SESSION_REPLAY_CDN_BASE_URL}/session-replay.browser.legacy.min.js`
export const SESSION_REPLAY_BACKGROUND_SERVICE_URL = `${SESSION_REPLAY_CDN_BASE_URL}/background-service.html`
