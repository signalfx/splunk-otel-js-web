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
import { INPMetricWithAttribution } from 'web-vitals/attribution'

import { setNumberAttribute, setStringAttribute } from './span-attributes'
import { WebVitalsAttributionOptions } from './types'

export function setINPAttributionAttributes(
	span: Span,
	metric: INPMetricWithAttribution,
	options: WebVitalsAttributionOptions,
): void {
	const { attribution } = metric

	if (options.shouldExportTarget) {
		setStringAttribute(span, 'inp.interaction_target', attribution.interactionTarget)
	}

	setNumberAttribute(span, 'inp.interaction_time', attribution.interactionTime)
	setStringAttribute(span, 'inp.interaction_type', attribution.interactionType)
	setNumberAttribute(span, 'inp.next_paint_time', attribution.nextPaintTime)
	setNumberAttribute(span, 'inp.input_delay', attribution.inputDelay)
	setNumberAttribute(span, 'inp.processing_duration', attribution.processingDuration)
	setNumberAttribute(span, 'inp.presentation_delay', attribution.presentationDelay)
	setStringAttribute(span, 'inp.load_state', attribution.loadState)
	setNumberAttribute(span, 'inp.total_script_duration', attribution.totalScriptDuration)
	setNumberAttribute(span, 'inp.total_style_and_layout_duration', attribution.totalStyleAndLayoutDuration)
	setNumberAttribute(span, 'inp.total_paint_duration', attribution.totalPaintDuration)
	setNumberAttribute(span, 'inp.total_unattributed_duration', attribution.totalUnattributedDuration)
	setStringAttribute(span, 'inp.longest_script_subpart', attribution.longestScript?.subpart)
	setNumberAttribute(
		span,
		'inp.longest_script_intersecting_duration',
		attribution.longestScript?.intersectingDuration,
	)
}
