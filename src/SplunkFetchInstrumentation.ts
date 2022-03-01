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
  }

  enable(): void {
    // Don't attempt in browsers where there's no fetch API
    if (!window.fetch) {
      return;
    }

    super.enable();
  }
}
