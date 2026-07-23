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

export const BLOCKING_ELEMENT_MODULE_NAME = 'splunk-blocking-element'
export const BLOCKING_ELEMENT_SPAN_NAME = 'blockingElement'

export const BROWSER_ELEMENT_SELECTOR_ATTRIBUTE = 'browser.element.selector'
export const BROWSER_ELEMENT_ID_ATTRIBUTE = 'browser.element.id'
export const BROWSER_ELEMENT_CLASS_ATTRIBUTE = 'browser.element.class'
export const BROWSER_ELEMENT_TAG_ATTRIBUTE = 'browser.element.tag'
export const BROWSER_ELEMENT_XPATH_ATTRIBUTE = 'browser.element.xpath'
export const BROWSER_ELEMENT_COMPLETION_ATTRIBUTE = 'browser.element.completion'
export const BROWSER_ELEMENT_COMPLETION_COMPLETED = 'completed'
export const BROWSER_ELEMENT_COMPLETION_INTERRUPTED = 'interrupted'

/** Sanity cap on concurrently open element spans; startSpan no-ops past this. */
export const MAX_OPEN_ELEMENT_SPANS = 1000
