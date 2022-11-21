/*
Copyright 2021 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { AlwaysOffSampler, AlwaysOnSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base';
import { SessionBasedSampler } from './SessionBasedSampler';

if( typeof Symbol !== 'function') {
  const noop = function(){};
  window.SplunkRum = {
    DEFAULT_AUTO_INSTRUMENTED_EVENTS: {},
    DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES: [],
    init: noop,
    inited: false,
    error: noop,
    setGlobalAttributes: noop,
    deinit: noop,
    AlwaysOnSampler,
    AlwaysOffSampler,
    ParentBasedSampler,
    SessionBasedSampler,
    _internalInit: noop,
    addEventListener: noop,
    getGlobalAttributes: () => ({}),
    getSessionId: () => undefined,
    removeEventListener: noop,
    _experimental_addEventListener: noop,
    _experimental_getGlobalAttributes: () => ({}),
    _experimental_getSessionId: () => undefined,
    _experimental_removeEventListener: noop,
  };
  throw new Error('SplunkRum: browser not supported, disabling instrumentation.');
}
