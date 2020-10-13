// FIXME this is a nasty copy+paste hack to get the zipkin exporter able to work in a browser context.
import {toZipkinSpan, statusCodeTagName, statusDescriptionTagName} from '../deps/opentelemetry-js/packages/opentelemetry-exporter-zipkin/src/transform';
import {ExportResult} from '@opentelemetry/core';
import {limitLen} from './utils';

export function truncate(zspan, lengthLimit) {
  zspan.name = limitLen(zspan.name, lengthLimit);
  for (const [key, value] of Object.entries(zspan.tags)) {
    zspan.tags[key] = limitLen(value, lengthLimit);
  }
}

export class PatchedZipkinExporter {
  constructor(beaconUrl, options) {
    this.beaconUrl = beaconUrl;
    this.recordedValueMaxLength = (options || {}).recordedValueMaxLength;
  }

  export(spans, resultCallback) {
    const zspans = spans.map(span => this.modZipkinSpan(span));
    const zJson = JSON.stringify(zspans);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.beaconUrl, zJson);
    }
    resultCallback(ExportResult.SUCCESS);
  }

  shutdown() {
  }

  modZipkinSpan(span) {
    // this trims off some stuff added by the default zipkin exporter.  Cleaner than copy+pasting the code
    span.resource = {attributes:{}};
    const zspan = toZipkinSpan(span, 'browser', statusCodeTagName, statusDescriptionTagName);
    delete zspan.localEndpoint;
    truncate(zspan, this.recordedValueMaxLength);
    return zspan;
  }

}
