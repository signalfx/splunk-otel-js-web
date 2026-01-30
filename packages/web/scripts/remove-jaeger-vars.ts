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

import * as fs from 'node:fs'
import path from 'node:path'

const bundlePath = path.join(__dirname, '../dist/artifacts/splunk-otel-web.js')

// Read the bundle
let content = fs.readFileSync(bundlePath, 'utf8')

// Replace OTEL_EXPORTER_JAEGER_PASSWORD with a different name to avoid GitHub secret scanning.
//
// This variable is not used by our application (we use OTLP and Zipkin exporters, not Jaeger).
// The variable is inherited from @opentelemetry/core's DEFAULT_ENVIRONMENT object and is always
// empty (""). It is NEVER set to any value in our code.
//
// However, the variable NAME itself (containing the word "PASSWORD") triggers false positive
// alerts in GitHub's secret scanning when customers push our bundle as an asset to their repositories.
//
// Since this variable is completely unused and always empty, we replace the name with
// OTEL_EXPORTER_JAEGER_P to prevent these false positive security alerts while keeping
// the code structure valid.
content = content.replaceAll('OTEL_EXPORTER_JAEGER_PASSWORD', 'OTEL_EXPORTER_JAEGER_P')

// Write back
fs.writeFileSync(bundlePath, content)

console.log('Replaced OTEL_EXPORTER_JAEGER_PASSWORD with OTEL_EXPORTER_JAEGER_P in bundle')
