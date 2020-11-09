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

export function truncate(zspan) {
  zspan.name = limitLen(zspan.name, MAX_VALUE_LIMIT);
  for (const [key, value] of Object.entries(zspan.tags)) {
    zspan.tags[key] = limitLen(value, MAX_VALUE_LIMIT);
  }
}

export class PatchedZipkinExporter {
  constructor(beaconUrl) {
    this.beaconUrl = beaconUrl;
  }

  export(spans, resultCallback) {
    const zspans = spans.map(span => this.modZipkinSpan(span));
    const zJson = JSON.stringify(zspans);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.beaconUrl, zJson);
    }
    resultCallback(ExportResultCode.SUCCESS);
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
