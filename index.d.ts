import { SpanAttributes, Span } from "@opentelemetry/api";
import { InstrumentationConfig } from "@opentelemetry/instrumentation";
import { FetchInstrumentationConfig } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentationConfig } from "@opentelemetry/instrumentation-xml-http-request";
import { WebTracerProvider } from "@opentelemetry/web";

type SplunkUserInteractionInstrumentationConfig = {
  events?: {
    [type: string]: boolean;
  }; 
};
type PostDocLoadResourceObserverConfig = {
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
  instrumentations?: {
    document?: boolean | InstrumentationConfig,
    xhr?: boolean | (XMLHttpRequestInstrumentationConfig & InstrumentationConfig),
    interactions?: boolean | (InstrumentationConfig & SplunkUserInteractionInstrumentationConfig),
    postload?: boolean | (InstrumentationConfig & PostDocLoadResourceObserverConfig),
    fetch?: boolean | (FetchInstrumentationConfig & InstrumentationConfig),
    websocket?: boolean | InstrumentationConfig,
    longtask?: boolean | InstrumentationConfig,
    errors?: boolean,
    webvitals?: boolean,
  };
  rumAuth: string;
  ignoreUrls: Array<String | RegExp>;
}

type SplunkOtel = {
  init: (options: SplunkOtelOptions) => void;
  deinit: () => void;
  setGlobalAttributes: (attributes: SpanAttributes) => void;
  provider?: WebTracerProvider;
}

export default SplunkOtel;
