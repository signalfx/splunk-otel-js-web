// FIXME this is a nasty copy+paste hack to get the zipkin exporter able to work in a browser context.
import {toZipkinSpan, statusCodeTagName, statusDescriptionTagName} from '../deps/opentelemetry-js/packages/opentelemetry-exporter-zipkin/src/transform';

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
    resultCallback('SUCCESS');
  }

  shutdown() {
  }

  modZipkinSpan(span) {
    // this trims off some stuff added by the default zipkin exporter.  Cleaner than copy+pasting the code
    span.resource = {attributes:{}};
    const zspan = toZipkinSpan(span, 'browser', statusCodeTagName, statusDescriptionTagName);
    delete zspan.localEndpoint;
    return zspan;
  }

}
