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

import {XMLHttpRequestInstrumentation} from '@opentelemetry/instrumentation-xml-http-request';
import {FetchPlugin} from '@opentelemetry/plugin-fetch';
import {captureTraceParent} from './servertiming';

export class SplunkXhrPlugin extends XMLHttpRequestInstrumentation {
  _createSpan(xhr, url, method) {
    const span = super._createSpan(xhr, url, method);
    // if this url is ignored then there is no span
    if (span) {
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
    }
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
