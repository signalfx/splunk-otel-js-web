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

import { FetchInstrumentation, FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch';
import * as api from '@opentelemetry/api';
import { captureTraceParent } from './servertiming';

// not exporter, but we can leverage TS structural typing
interface FetchResponse {
  status: number;
  statusText?: string;
  url: string;
  headers: Headers;
}
type AddFinalSpanAttributesFn = (span: api.Span, response: FetchResponse) => void;
type ExposedSuper = {
  _addFinalSpanAttributes: AddFinalSpanAttributesFn;
  _patchConstructor: () => (orig: Window['fetch']) => Window['fetch'];
};

interface FetchError {
  status?: number;
  message: string;
}

export class SplunkFetchInstrumentation extends FetchInstrumentation {
  constructor(config: FetchInstrumentationConfig = {}) {
    super(config);

    const _superAddFinalSpanAttributes = (this as any as ExposedSuper)._addFinalSpanAttributes;
    (this as any as ExposedSuper)._addFinalSpanAttributes = (span, fetchResponse) => {
      if (span && fetchResponse && fetchResponse.headers) {
        const st = fetchResponse.headers.get('Server-Timing');
        if (st) {
          captureTraceParent(st, span);
        }
      }
      return _superAddFinalSpanAttributes(span, fetchResponse);
    };

    // Remove with 0.25 release
    (this as any as ExposedSuper)._patchConstructor = function(): (original: Window['fetch']) => Window['fetch'] {
      return original => {
        const plugin = this;
        return function patchConstructor(
          this: Window,
          ...args: Parameters<Window['fetch']>
        ): Promise<Response> {
          const url = args[0] instanceof Request ? args[0].url : args[0];
          const options = args[0] instanceof Request ? args[0] : args[1] || {};
          const createdSpan = plugin._createSpan(url, options);
          if (!createdSpan) {
            return original.apply(this, args);
          }
          const spanData = plugin._prepareSpanData(url);
  
          function endSpanOnError(span: api.Span, error: FetchError) {
            plugin._applyAttributesAfterFetch(span, options, error);
            plugin._endSpan(span, spanData, {
              status: error.status || 0,
              statusText: error.message,
              url,
            });
          }
  
          function endSpanOnSuccess(span: api.Span, response: Response) {
            plugin._applyAttributesAfterFetch(span, options, response);
            if (response.status >= 200 && response.status < 400) {
              plugin._endSpan(span, spanData, response);
            } else {
              plugin._endSpan(span, spanData, {
                status: response.status,
                statusText: response.statusText,
                url,
              });
            }
          }
          function onSuccess(
            span: api.Span,
            resolve: (
              value?: Response | PromiseLike<Response> | undefined
            ) => void,
            response: Response
          ) {
            try {
              const resClone = response.clone();
              const body = resClone.body;
              if (body) {
                const reader = body.getReader();
                const read = (): void => {
                  reader.read().then(
                    ({ done }) => {
                      if (done) {
                        endSpanOnSuccess(span, response);
                      } else {
                        read();
                      }
                    },
                    error => {
                      endSpanOnError(span, error);
                    }
                  );
                };
                read();
              } else {
                // some older browsers don't have .body implemented
                endSpanOnSuccess(span, response);
              }
            } finally {
              resolve(response);
            }
          }
  
          function onError(
            span: api.Span,
            reject: (reason?: unknown) => void,
            error: FetchError
          ) {
            try {
              endSpanOnError(span, error);
            } finally {
              reject(error);
            }
          }
  
          return new Promise((resolve, reject) => {
            return api.context.with(
              api.trace.setSpan(api.context.active(), createdSpan),
              () => {
                plugin._addHeaders(options, url);
                plugin._tasksCount++;
                return original
                  .apply(this, options instanceof Request ? [options] : [url, options])
                  .then(
                    (onSuccess as any).bind(this, createdSpan, resolve),
                    onError.bind(this, createdSpan, reject)
                  );
              }
            );
          });
        };
      };
    };
  }

  enable(): void {
    // Don't attempt in browsers where there's no fetch API
    if (!window.fetch) {
      return;
    }

    super.enable();
  }
}
