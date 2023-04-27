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

import { HrTime } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { FetchInstrumentation, FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch';
import { captureTraceParent } from './servertiming';

interface SpanData {
  entries: PerformanceResourceTiming[];
  observer?: PerformanceObserver;
  spanUrl: string;
  startTime: HrTime;
}

type ExposedSuper = {
  _prepareSpanData: (spanUrl: string) => SpanData;
};

export class SplunkFetchInstrumentation extends FetchInstrumentation {
  constructor(config: FetchInstrumentationConfig = {}) {
    const origCustomAttrs = config.applyCustomAttributesOnSpan;
    config.applyCustomAttributesOnSpan = function (span, request, result) {
      // Temporary return to old span name until cleared by backend
      span.updateName(`HTTP ${(request.method || 'GET').toUpperCase()}`);
      span.setAttribute('component', 'fetch');

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

    const _superPrepareSpanData = (this as unknown as ExposedSuper)._prepareSpanData.bind(this) as ExposedSuper['_prepareSpanData'];
    (this as any as ExposedSuper)._prepareSpanData = (spanUrl: string) => {
      // Fix: PerformanceObserver feature detection is broken and crashes in IE
      // Is fixed in 0.29.0 but contrib isn't updated yet
      if (
        typeof PerformanceObserver !== 'function'
      ) {
        const startTime = hrTime();
        const entries: PerformanceResourceTiming[] = [];
        return { entries, startTime, spanUrl };
      }

      return _superPrepareSpanData(spanUrl);
    };
  }

  enable(): void {
    // Don't attempt in browsers where there's no fetch API
    if (!window.fetch) {
      return;
    }

    super.enable();
  }
}
