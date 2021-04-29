import { FetchInstrumentation, FetchInstrumentationConfig } from "@opentelemetry/instrumentation-fetch";
import * as api from '@opentelemetry/api';
import { captureTraceParent } from "./servertiming";

// not exporter, but we can leverage TS structural typing
interface FetchResponse {
  status: number;
  statusText?: string;
  url: string;
  headers: Headers;
}
type AddFinalSpanAttributesFn = (span: api.Span, response: FetchResponse) => void;
type ExposedSuper = { _addFinalSpanAttributes: AddFinalSpanAttributesFn };

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
    }
  }

  enable() {
    // Don't attempt in browsers where there's no fetch API
    if (!window.fetch) {
      return;
    }

    super.enable();
  }
}
