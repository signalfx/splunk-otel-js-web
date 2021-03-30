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

import {
  toZipkinSpan, 
  statusCodeTagName, 
  statusDescriptionTagName,
} from '@opentelemetry/exporter-zipkin/build/src/transform.js';
import {ExportResultCode} from '@opentelemetry/core';
import {limitLen} from './utils';
import { Resource } from '@opentelemetry/resources';

const MAX_VALUE_LIMIT = 4096;
const SPAN_RATE_LIMIT_PERIOD = 30000; // millis, sweep to clear out span counts
const MAX_SPANS_PER_PERIOD_PER_COMPONENT = 100;
const SERVICE_NAME = 'browser';

export const TRANSFORM_ATTRIBUTES = (attributes) => attributes;
export const XHR_SENDER = (url, data) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.setRequestHeader('Accept', '*/*');
  xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
  xhr.send(data);
};
export const BEACON_SENDER = navigator.sendBeacon ? (url, data) => navigator.sendBeacon(url, data) : null;

/**
 * SplunkExporter is based on Zipkin V2. It includes Splunk-specific modifications.
 */
export class SplunkExporter {
  constructor({
    beaconUrl,
    onAttributesSerializing = TRANSFORM_ATTRIBUTES, 
    xhrSender = XHR_SENDER,
    beaconSender = BEACON_SENDER,
  }) {
    this.beaconUrl = beaconUrl;
    this._onAttributesSerializing = onAttributesSerializing;
    this._xhrSender = xhrSender;
    this._beaconSender = beaconSender;
    this.spanCounts = {};
    this._limiterHandle = setInterval(() => {
      this.spanCounts = {};
    }, SPAN_RATE_LIMIT_PERIOD);
  }

  filter(span) {
    const component = span.attributes && span.attributes.component ? span.attributes.component : 'unknown';
    if (!this.spanCounts[component]) {
      this.spanCounts[component] = 0;
    }
    return this.spanCounts[component]++ < MAX_SPANS_PER_PERIOD_PER_COMPONENT;
  }

  export(spans, resultCallback) {
    spans = spans.filter(span => this.filter(span));
    const zspans = spans.map(span => this._mapToZipkinSpan(span));
    const zJson = JSON.stringify(zspans);
    if (this._beaconSender) {
      this._beaconSender(this.beaconUrl, zJson);
    } else {
      this._xhrSender(this.beaconUrl, zJson);
    }
    resultCallback({code: ExportResultCode.SUCCESS});
  }

  shutdown() {
    clearInterval(this._limiterHandle);
  }

  _mapToZipkinSpan(span) {
    const preparedSpan = this._preTranslateSpan(span);
    const zspan = toZipkinSpan(preparedSpan, SERVICE_NAME, statusCodeTagName, statusDescriptionTagName);
    return this._postTranslateSpan(zspan);
  }

  _preTranslateSpan(span) {
    return {
      // todo: once typescript is implemented, conform to ReadableSpan
      // note: some properties in Span are not enumerable, and as a result cannot be spread or Object.assign'ed
      name: span.name,
      kind: span.kind,
      spanContext: span.spanContext,
      parentSpanId: span.parentSpanId,
      startTime: span.startTime,
      endTime: span.endTime,
      status: span.status,
      links: span.links,
      events: span.events,
      duration: span.duration,
      ended: span.ended,
      instrumentationLibrary: span.instrumentationLibrary,
      
      resource: Resource.EMPTY,
      attributes: this._onAttributesSerializing(span.attributes, span),
    };
  }

  _postTranslateSpan(zipkinSpan) {
    delete zipkinSpan.localEndpoint;
    zipkinSpan.name = limitLen(zipkinSpan.name, MAX_VALUE_LIMIT);
    for (const [key, value] of Object.entries(zipkinSpan.tags)) {
      zipkinSpan.tags[key] = limitLen(value, MAX_VALUE_LIMIT);
    }
    return zipkinSpan;
  }
}
