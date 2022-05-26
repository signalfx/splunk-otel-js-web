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

import { FetchInstrumentation, FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch';
import { captureTraceParent } from './servertiming';

export class SplunkFetchInstrumentation extends FetchInstrumentation {
  constructor(config: FetchInstrumentationConfig = {}) {
    const origCustomAttrs = config.applyCustomAttributesOnSpan;
    config.applyCustomAttributesOnSpan = function (span, request, result) {
      if (span && result instanceof Response && result.headers) {
        const st = result.headers.get('Server-Timing');
        if (st) {
          captureTraceParent(st, span);
        }
      }
      if (origCustomAttrs) {
        origCustomAttrs(span, request, result);
      }
    };

    super(config);
  }

  enable(): void {
    // Don't attempt in browsers where there's no fetch API
    if (!window.fetch) {
      return;
    }

    super.enable();
  }
}
