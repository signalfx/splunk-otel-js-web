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

import { diag } from '@opentelemetry/api';
import { VERSION } from './version';

const GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for('opentelemetry.js.api.1');

/**
 * otel-api's global function. This isn't exported by otel/api but would be
 * super useful to register global components for experimental purposes...
 * For us, it's included to register components accessed by other packages,
 * eg. sharing session id manager with session recorder
 */
export function registerGlobal(
  type: string,
  instance: unknown,
  allowOverride = false
): boolean {
  if (!globalThis[GLOBAL_OPENTELEMETRY_API_KEY]) {
    diag.error('SplunkRum: Tried to access global before otel setup');
    return false;
  }
  const api = globalThis[GLOBAL_OPENTELEMETRY_API_KEY];

  if (!api['splunk.rum.version']) {
    api['splunk.rum.version'] = VERSION;
  }
  if (api['splunk.rum.version'] !== VERSION) {
    diag.error(`SplunkRum: Global: Multiple versions detected (${VERSION} already registered)`);
    return false;
  }

  if (!allowOverride && api[type]) {
    diag.error(`SplunkRum: Attempted duplicate registration of otel API ${type}`);
    return false;
  }

  api[type] = instance;
  return true;
}

export function unregisterGlobal(
  type: string,
): boolean {
  const api = globalThis[GLOBAL_OPENTELEMETRY_API_KEY];
  if (!api) {
    diag.warn(`OTel API ref was missing while trying to unregister ${type}`);
    return false;
  }

  if (!!api['splunk.rum.version'] && api['splunk.rum.version'] !== VERSION) {
    diag.warn(`SplunkRum version in OTel API ref (${api['splunk.rum.version']}) didn't match our version (${VERSION}).`);
  }

  delete api[type];
  return true;
}
