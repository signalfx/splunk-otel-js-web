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

import { Span } from '@opentelemetry/api'

import { setRoundedNumberAttribute, setStringAttribute } from '../../utils/span-attributes'
import { LOAF_MODULE_NAME } from './constants'
import { getLoafScriptSummaries } from './script-summary'
import { type PerformanceLongAnimationFrameTiming } from './types'

export function setLoafEntryAttributes(span: Span, entry: PerformanceLongAnimationFrameTiming): void {
	span.setAttribute('component', LOAF_MODULE_NAME)
	setStringAttribute(span, 'loaf.name', entry.name)
	setStringAttribute(span, 'loaf.entry_type', entry.entryType)
	setRoundedNumberAttribute(span, 'loaf.duration', entry.duration)
	setRoundedNumberAttribute(span, 'loaf.blocking_duration', entry.blockingDuration)
	setRoundedNumberAttribute(span, 'loaf.paint_time', entry.paintTime)
	setRoundedNumberAttribute(span, 'loaf.presentation_time', entry.presentationTime)
	setRoundedNumberAttribute(span, 'loaf.render_start', entry.renderStart)
	setRoundedNumberAttribute(span, 'loaf.style_and_layout_start', entry.styleAndLayoutStart)
	setRoundedNumberAttribute(span, 'loaf.first_ui_event_timestamp', entry.firstUIEventTimestamp)

	const scripts = Array.isArray(entry.scripts) ? entry.scripts : []
	setRoundedNumberAttribute(span, 'loaf.script_count', scripts.length)

	getLoafScriptSummaries(scripts).forEach((script, index) => {
		const prefix = `loaf.script[${index}]`
		setRoundedNumberAttribute(span, `${prefix}.duration`, script.duration)
		setRoundedNumberAttribute(span, `${prefix}.execution_start`, script.executionStart)
		setStringAttribute(span, `${prefix}.invoker`, script.invoker)
		setStringAttribute(span, `${prefix}.invoker_type`, script.invokerType)
		setRoundedNumberAttribute(span, `${prefix}.pause_duration`, script.pauseDuration)
		setRoundedNumberAttribute(span, `${prefix}.source_char_position`, script.sourceCharPosition)
		setStringAttribute(span, `${prefix}.source_url`, script.sourceURL)
		setStringAttribute(span, `${prefix}.source_function_name`, script.sourceFunctionName)
		setRoundedNumberAttribute(
			span,
			`${prefix}.forced_style_and_layout_duration`,
			script.forcedStyleAndLayoutDuration,
		)
		setRoundedNumberAttribute(span, `${prefix}.start_time`, script.startTime)
		setStringAttribute(span, `${prefix}.window_attribution`, script.windowAttribution)
	})
}
