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

import {toZipkinSpan, statusCodeTagName, statusDescriptionTagName} from '../deps/opentelemetry-js/packages/opentelemetry-exporter-zipkin/src/transform';
import {ExportResultCode} from '@opentelemetry/core';
import {limitLen} from './utils';

const MAX_VALUE_LIMIT = 4096;
const SPAN_RATE_LIMIT_PERIOD = 30000; // millis, sweep to clear out span counts
const MAX_SPANS_PER_PERIOD_PER_COMPONENT = 100;

export function truncate(zspan) {
  zspan.name = limitLen(zspan.name, MAX_VALUE_LIMIT);
  for (const [key, value] of Object.entries(zspan.tags)) {
    zspan.tags[key] = limitLen(value, MAX_VALUE_LIMIT);
  }
}

export class PatchedZipkinExporter {
  constructor(beaconUrl) {
    this.beaconUrl = beaconUrl;
    this.spanCounts = {};
    const exporter = this;
    setInterval(() => {
      exporter.spanCounts = {};
    }, SPAN_RATE_LIMIT_PERIOD);
  }

  filter(span) {
    const component = span.attributes ? span.attributes.component || 'unknown' : 'unknown';
    if (!this.spanCounts[component]) {
      this.spanCounts[component] = 0;
    }
    return this.spanCounts[component]++ < MAX_SPANS_PER_PERIOD_PER_COMPONENT;
  }

  export(spans, resultCallback) {
    const exporter = this;
    spans = spans.filter(span => exporter.filter(span));
    const zspans = spans.map(span => this.modZipkinSpan(span));
    const zJson = JSON.stringify(zspans);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.beaconUrl, zJson);
    }
    resultCallback({code: ExportResultCode.SUCCESS});
  }

  shutdown() {
  }

  modZipkinSpan(span) {
    // this trims off some stuff added by the default zipkin exporter.  Cleaner than copy+pasting the code
    span.resource = {attributes:{}};
    const zspan = toZipkinSpan(span, 'browser', statusCodeTagName, statusDescriptionTagName);
    delete zspan.localEndpoint;
    truncate(zspan);
    return zspan;
  }

}
