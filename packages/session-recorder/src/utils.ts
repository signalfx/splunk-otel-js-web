/*
Copyright 2024 Splunk Inc.

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

import { VERSION } from './version';

const GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for('opentelemetry.js.api.1');
/**
 * otel-api's global function. This isn't exported by otel/api but would be
 * super useful to access global components for experimental purposes...
 * For us, it's included to access components accessed by other packages,
 * eg. sharing session id manager with session recorder
 */
export function getGlobal<Type>(
  type: string
): Type | undefined {
  const globalSplunkRumVersion = globalThis[GLOBAL_OPENTELEMETRY_API_KEY]?.['splunk.rum.version'];
  if (!globalSplunkRumVersion || globalSplunkRumVersion !== VERSION) {
    console.warn(`SplunkSessionRecorder: Version mismatch with SplunkRum (RUM: ${globalSplunkRumVersion}, recorder: ${VERSION})`);
    return undefined; // undefined for eslint
  }

  return globalThis[GLOBAL_OPENTELEMETRY_API_KEY]?.[type];
}
