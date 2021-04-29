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
import {ExportResult, ExportResultCode} from '@opentelemetry/core';
import {limitLen} from './utils';
import { Resource } from '@opentelemetry/resources';
import { SpanAttributes, Span, SpanKind } from '@opentelemetry/api';
import { ReadableSpan, SpanExporter } from '@opentelemetry/tracing';

const MAX_VALUE_LIMIT = 4096;
const SPAN_RATE_LIMIT_PERIOD = 30000; // millis, sweep to clear out span counts
const MAX_SPANS_PER_PERIOD_PER_COMPONENT = 100;
const SERVICE_NAME = 'browser';

export interface SplunkExporterConfig {
  beaconUrl: string;
  onAttributesSerializing?: (attributes: SpanAttributes, span: ReadableSpan) => SpanAttributes,
  xhrSender?: (url: string, data: BodyInit) => void,
  beaconSender?: (url: string, data: BodyInit) => void,
};

export const NOOP_ATTRIBUTES_TRANSFORMER: SplunkExporterConfig['onAttributesSerializing'] = (attributes) => attributes;
export const NATIVE_XHR_SENDER: SplunkExporterConfig['xhrSender'] = (url: string, data: BodyInit) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.setRequestHeader('Accept', '*/*');
  xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
  xhr.send(data);
};
export const NATIVE_BEACON_SENDER: SplunkExporterConfig['beaconSender'] = navigator.sendBeacon ? (url, data) => navigator.sendBeacon(url, data) : null;

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinSpan {
  traceId: string;
  name: string;
  parentId?: string;
  id: string;
  kind?: SpanKind;
  timestamp: number;
  duration: number;
  debug?: boolean;
  shared?: boolean;
  localEndpoint: ZipkinEndpoint;
  annotations?: ZipkinAnnotation[];
  tags: ZipkinTags;
}

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinAnnotation {
  timestamp: number;
  value: string;
}

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinEndpoint {
  serviceName?: string;
  ipv4?: string;
  port?: number;
}

// TODO: upstream proper exports from ZipkinExporter
export interface ZipkinTags {
  [tagKey: string]: unknown;
}

/**
 * SplunkExporter is based on Zipkin V2. It includes Splunk-specific modifications.
 */
export class SplunkExporter implements SpanExporter {
  // TODO: a test which relies on beaconUrl needs to be fixed first
  public readonly beaconUrl: string;
  private readonly _onAttributesSerializing: SplunkExporterConfig['onAttributesSerializing'];
  private readonly _xhrSender: SplunkExporterConfig['xhrSender'];
  private readonly _beaconSender: SplunkExporterConfig['beaconSender'];
  private readonly _spanCounts = new Map<string, number>();
  private readonly _limiterHandle: number;

  constructor({
    beaconUrl,
    onAttributesSerializing = NOOP_ATTRIBUTES_TRANSFORMER,
    xhrSender = NATIVE_XHR_SENDER,
    beaconSender = NATIVE_BEACON_SENDER,
  }: SplunkExporterConfig) {
    this.beaconUrl = beaconUrl;
    this._onAttributesSerializing = onAttributesSerializing;
    this._xhrSender = xhrSender;
    this._beaconSender = beaconSender;
    this._limiterHandle = window.setInterval(() => {
      this._spanCounts.clear();
    }, SPAN_RATE_LIMIT_PERIOD);
  }

  filter(span: ReadableSpan) {
    const component = (span.attributes?.component ?? 'unknown').toString();
    if (!this._spanCounts.has(component)) {
      this._spanCounts.set(component, -1);
    }
    const counter = this._spanCounts.get(component) + 1;
    this._spanCounts.set(component, counter);
    return counter < MAX_SPANS_PER_PERIOD_PER_COMPONENT;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ) {
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

  shutdown(): Promise<void> {
    clearInterval(this._limiterHandle);
    return Promise.resolve();
  }

  _mapToZipkinSpan(span: ReadableSpan): ZipkinSpan {
    const preparedSpan = this._preTranslateSpan(span);
    const zspan = toZipkinSpan(preparedSpan, SERVICE_NAME, statusCodeTagName, statusDescriptionTagName);
    return this._postTranslateSpan(zspan);
  }

  _preTranslateSpan(span: ReadableSpan): ReadableSpan {
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

  _postTranslateSpan(span: ZipkinSpan) {
    delete span.localEndpoint;
    span.name = limitLen(span.name, MAX_VALUE_LIMIT);
    for (const [key, value] of Object.entries(span.tags)) {
      span.tags[key] = limitLen(value.toString(), MAX_VALUE_LIMIT);
    }
    return span;
  }
}
