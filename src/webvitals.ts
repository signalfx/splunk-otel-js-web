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

// import { TracerProvider, Tracer } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { getFID, getLCP, getCLS, Metric } from 'web-vitals';
import { VERSION } from './version';
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation';

export class SplunkWebVitalsInstrumentation extends InstrumentationBase {
  private reported;

  constructor(config: InstrumentationConfig = {}) {
    super('splunk-webvitals', VERSION, Object.assign({}, config));
    this.reported = {};
  }

  init(): void {}

  enable(): void {
    console.log('Enable: webvitals');
    // CLS is defined as being sent more than once, easier to just ensure that everything is sent just on the first occurence.
    getFID((metric) => {
      this.report('fid', metric);
    });
    getCLS((metric) => {
      this.report('cls', metric);
    });
    getLCP((metric) => {
      this.report('lcp', metric);
    });
  }

  report(name: string, metric: Metric): void {
    console.log('Metric: ', metric);
    this.tracer.startSpan('web-vitals-test-span').end();
    if (this.reported[name]) {
      return;
    }
    this.reported[name] = true;

    const value = metric.value;
    const now = hrTime();

    const span = this.tracer.startSpan('webvitals', { startTime: now });
    span.setAttribute(name, value);
    span.end(now);
  }

  disable(): void {}
}