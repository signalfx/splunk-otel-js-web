/*
Copyright 2020 Splunk Inc.

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

import { TracerProvider, Tracer } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { getCLS, getLCP, getFID, Metric } from 'web-vitals';
const reported = {};

function report(tracer: Tracer, name: string, metric: Metric): void {
  if (reported[name]) {
    return;
  }
  reported[name] = true;

  const value = metric.value;
  const now = hrTime();

  const span = tracer.startSpan('webvitals', { startTime: now });
  span.setAttribute(name, value);
  span.end(now);
}

export function initWebVitals(provider: TracerProvider): void {
  const tracer = provider.getTracer('webvitals');
  // CLS is defined as being sent more than once, easier to just ensure that everything is sent just on the first occurence.
  getFID((metric) => {
    report(tracer, 'fid', metric);
  });
  getCLS((metric) => {
    report(tracer, 'cls', metric);
  });
  getLCP((metric) => {
    report(tracer, 'lcp', metric);
  });
}
