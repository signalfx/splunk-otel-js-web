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

if( typeof Symbol !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noop = function(){};
  window.SplunkRum = {
    DEFAULT_AUTO_INSTRUMENTED_EVENTS: {},
    inited: false,
    version: __SPLUNK_OTEL_WEB_BUILD_VERSION,
    init: noop,
    error: noop,
    setGlobalAttributes: noop,
    deinit: noop,
    _internalInit: noop,
    _experimental_addEventListener: noop,
    _experimental_getGlobalAttributes: () => ({}),
    _experimental_getSessionId: () => null,
    _experimental_removeEventListener: noop,
  };
  throw new Error('SplunkRum: browser not supported, disabling instrumentation.');
}
