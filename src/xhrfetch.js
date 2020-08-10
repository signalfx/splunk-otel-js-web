import {XMLHttpRequestPlugin} from '@opentelemetry/plugin-xml-http-request';
import {FetchPlugin} from '@opentelemetry/plugin-fetch';
import {captureTraceParent} from './servertiming';

export class SplunkXhrPlugin extends XMLHttpRequestPlugin {
  _createSpan(xhr, url, method) {
    const span = super._createSpan(xhr, url, method);
    // don't care about success/failure, just want to see response headers if they exist
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === xhr.HEADERS_RECEIVED && xhr.getAllResponseHeaders().includes('server-timing')) {
        const st = xhr.getResponseHeader('server-timing');
        if (st) {
          captureTraceParent(st, span);
        }
      }
    });
    // FIXME long-term answer for deprecating attributes.component?
    span.setAttribute('component', this.moduleName);
    return span;
  }

}

export class SplunkFetchPlugin extends FetchPlugin {
  _addFinalSpanAttributes(span, fetchResponse) {
    if (span && fetchResponse && fetchResponse.headers) {
      const st = fetchResponse.headers.get('Server-Timing');
      if (st) {
        captureTraceParent(st, span);
      }
    }
    return super._addFinalSpanAttributes(span, fetchResponse);
  }
}
