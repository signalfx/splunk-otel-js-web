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

import {
	SessionReplay as SessionReplayOriginal,
	SessionReplayPlain as SessionReplayPlainOriginal,
	// @ts-expect-error Remote module
} from 'https://cdn.signalfx.com/o11y-gdi-rum/session-replay/v1.31.0/session-replay.module.min.js'
import { SessionReplayPlainClass, SessionReplayClass } from './types'

export const SessionReplay: SessionReplayClass = SessionReplayOriginal

export const SessionReplayPlain: SessionReplayPlainClass = SessionReplayPlainOriginal
