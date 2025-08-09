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
export const SESSION_ID_LENGTH = 32
export const SESSION_DURATION_SECONDS = 4 * 60 * 60 // 4 hours
export const SESSION_DURATION_MS = SESSION_DURATION_SECONDS * 1000
export const SESSION_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
export const SESSION_INACTIVITY_TIMEOUT_SECONDS = SESSION_INACTIVITY_TIMEOUT_MS / 1000
export const SESSION_STORAGE_KEY = '_splunk_rum_sid'
