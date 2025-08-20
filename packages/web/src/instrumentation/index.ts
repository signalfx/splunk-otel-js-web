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
export { SplunkDocumentLoadInstrumentation } from './browser/SplunkDocumentLoadInstrumentation'
export { SplunkPageVisibilityInstrumentation } from './browser/SplunkPageVisibilityInstrumentation'
export { SplunkConnectivityInstrumentation } from './browser/SplunkConnectivityInstrumentation'

// Network instrumentation
export { SplunkFetchInstrumentation } from './network/SplunkFetchInstrumentation'
export { SplunkXhrPlugin } from './network/SplunkXhrPlugin'
export { SplunkWebSocketInstrumentation } from './network/SplunkWebSocketInstrumentation'

// User interaction instrumentation
export {
	SplunkUserInteractionInstrumentation,
	DEFAULT_AUTO_INSTRUMENTED_EVENTS,
	DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES,
	UserInteractionEventsConfig,
	SplunkUserInteractionInstrumentationConfig,
} from './user/SplunkUserInteractionInstrumentation'
export { SplunkLongTaskInstrumentation } from './user/SplunkLongTaskInstrumentation'

// Error instrumentation
export {
	SplunkErrorInstrumentation,
	ERROR_INSTRUMENTATION_NAME,
	SplunkErrorInstrumentationConfig,
} from './errors/SplunkErrorInstrumentation'

// Resource instrumentation
export {
	SplunkPostDocLoadResourceInstrumentation,
	SplunkPostDocLoadResourceInstrumentationConfig,
} from './resources/SplunkPostDocLoadResourceInstrumentation'

// Messaging instrumentation
export {
	SplunkSocketIoClientInstrumentation,
	SocketIoClientInstrumentationConfig,
} from './messaging/SplunkSocketIoClientInstrumentation'
