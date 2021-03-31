import { SpanAttributes, Span } from "@opentelemetry/api";
import { InstrumentationConfig } from "@opentelemetry/instrumentation";
import { FetchInstrumentationConfig } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentationConfig } from "@opentelemetry/instrumentation-xml-http-request";
import { WebTracerProvider } from "@opentelemetry/web";

type SplunkUserInteractionInstrumentationConfig = InstrumentationConfig & {
  events?: {
    [type: string]: boolean;
  }; 
};
type PostDocLoadResourceObserverConfig = InstrumentationConfig & {
  allowedInitiatorTypes?: string[];
};

type SplunkOtelOptions = {
  allowInsecureBeacon?: boolean;
  beaconUrl: string;
  cookieDomain?: string;
  debug?: boolean;
  environment?: string;
  exporter?: {
    onAttributesSerializing?: (attributes: SpanAttributes, span: Span) => SpanAttributes;
  };
  ignoreUrls: Array<String | RegExp>;
  instrumentations?: {
    document?:     boolean | InstrumentationConfig;
    errors?:       boolean;
    fetch?:        boolean | FetchInstrumentationConfig;
    interactions?: boolean | SplunkUserInteractionInstrumentationConfig;
    longtask?:     boolean | InstrumentationConfig;
    postload?:     boolean | PostDocLoadResourceObserverConfig;
    websocket?:    boolean | InstrumentationConfig;
    webvitals?:    boolean;
    xhr?:          boolean | XMLHttpRequestInstrumentationConfig;
  };
  rumAuth: string;
}

type SplunkOtel = {
  deinit: () => void;
  init: (options: SplunkOtelOptions) => void;
  provider?: WebTracerProvider;
  setGlobalAttributes: (attributes: SpanAttributes) => void;
}

export default SplunkOtel;
