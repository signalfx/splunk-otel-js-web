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

/// <reference types="./cdn-module-types.d.ts" preserve="true" />
// Local development: using local HTTP server
// @ts-expect-error - HTTP module import resolved by webpack buildHttp
export { createPicker } from 'http://localhost:8080/picker.module.min.js'
// Production: https://cdn.signalfx.com/o11y-gdi-rum/picker/v1.0.0/picker.module.min.js
// If you update the module version above, also update the version in cdn-module-types.d.ts.

