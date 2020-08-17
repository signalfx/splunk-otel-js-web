// FIXME this is a nasty copy+paste hack to get the zipkin exporter able to work in a browser context.
import * as api from '@opentelemetry/api';
import {hrTimeToMicroseconds} from '@opentelemetry/core';

export class PatchedZipkinExporter {
  constructor(beaconUrl) {
    this.beaconUrl = beaconUrl;
  }

  export(spans, resultCallback) {
    const zspans = spans.map(span => this.toZipkinSpan(span, 'browser'));
    const zJson = JSON.stringify(zspans);
    const useBeacon = true;
    if (useBeacon) {
      navigator.sendBeacon(this.beaconUrl, zJson);
    } else { // FIXME causes CORS problems typically - figure out how it's supposed to work long-term
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.beaconUrl);
      //xhr.setRequestHeader(collectorTypes.OT_REQUEST_HEADER, '1');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(zJson);
      // don't bother waiting for answer
    }
    resultCallback('SUCCESS');
  }

  shutdown() {
  }


  toZipkinTags(attrs, status, statusCodeTagName, statusDescriptionTagName) {
    const tags = {};
    for (const key of Object.keys(attrs)) {
      tags[key] = String(attrs[key]);
    }
    tags[statusCodeTagName] = String(api.CanonicalCode[status.code]);
    if (status.message) {
      tags[statusDescriptionTagName] = status.message;
    }
    // FIXME figure out what to do with resources when zipkin-for-web is integrated
    return tags;
  }

  toZipkinAnnotations(events) {
    return events.map(event => ({
      timestamp: hrTimeToMicroseconds(event.time),
      value: event.name,
    }));
  }

  toZipkinSpan(span, serviceName) {
    const ZIPKIN_SPAN_KIND_MAPPING = {
      [api.SpanKind.CLIENT]: 'CLIENT',
      [api.SpanKind.SERVER]: 'SERVER',
      [api.SpanKind.CONSUMER]: 'CONSUMER',
      [api.SpanKind.PRODUCER]: 'PRODUCER',
      // When absent, the span is local.
      [api.SpanKind.INTERNAL]: undefined,
    };
    return {
      traceId: span.spanContext.traceId,
      parentId: span.parentSpanId,
      name: span.name,
      id: span.spanContext.spanId,
      kind: ZIPKIN_SPAN_KIND_MAPPING[span.kind],
      timestamp: hrTimeToMicroseconds(span.startTime),
      duration: hrTimeToMicroseconds(span.duration),
      localEndpoint: {serviceName},
      tags: this.toZipkinTags(
        span.attributes,
        span.status,
        'ot.status_code',
        'ot.status_description'
      ),
      annotations: span.events.length
        ? this.toZipkinAnnotations(span.events)
        : undefined,
    };
  }


}
