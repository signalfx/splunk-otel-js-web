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

/// <reference types="./cdn-module-types.d.ts" preserve="true"  />
export {
	type ConfigFeatures,
	type PackAssetsConfig,
	type Segment,
	type SensitivityRule,
	type SensitivityRuleType,
	SessionReplay,
	type SessionReplayConfig,
	type SessionReplayPlainSegment,
	Stats,
} from 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/v2.5.6/session-replay.module.legacy.min.js'
import 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/v2.5.6/background-service.html'
// If you update the module version above, also update the version in cdn-module.d.ts.
// Regenerate webpack.lock: delete it, set frozen to false in webpack.config.js, then run `pnpm run build`.
