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

/**
 * Preload Script
 *
 * This script runs in an ISOLATED context (when contextIsolation is enabled).
 * It has access to Node.js APIs but runs in a separate JavaScript context
 * from the renderer process.
 *
 * IMPORTANT: DO NOT initialize Splunk RUM here!
 * - RUM must run in the actual renderer context (renderer.ts)
 * - Initializing RUM here would instrument the wrong context
 * - Your app would remain uninstrumented
 */

// Preload script content goes here
// Currently empty as no Node.js APIs need to be exposed
console.log('Preload script loaded')
