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

interface SplunkOtelWebExporterOptions {
  /**
   * Allows remapping Span's attributes right before they're serialized.
   * One potential use case of this method is to remove PII from the attributes.
   */
  onAttributesSerializing?: (attributes: SpanAttributes, span: Span) => SpanAttributes;
}

interface SplunkOtelWebOptions {
  /** Allows http beacon urls */
  allowInsecureBeacon?: boolean;

  /** Application name */
  app: string;

  /** Destination for the captured data */
  beaconUrl: string;

  /** Sets session cookie to this domain */
  cookieDomain?: string;

  /** Turns on/off internal debug logging */
  debug?: boolean;

  /** 
   * Sets a value for the `environment` attribute (persists through calls to `setGlobalAttributes()`) 
   * */
  environment?: string;

  /** Allows configuring how telemetry data is sent to the backend */
  exporter?: SplunkOtelWebExporterOptions;

  /** Sets attributes added to every Span. */
  globalAttributes?: {
    [attributeKey: string]: string;
  };

  /** 
   * Applies for XHR, Fetch and Websocket URLs. URLs that partially match any regex in ignoreUrls will not be traced. 
   * In addition, URLs that are _exact matches_ of strings in ignoreUrls will also not be traced.
   * */
  ignoreUrls?: Array<String | RegExp>;

  /** Configuration for instrumentation modules. */
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

  /** 
   * Publicly-visible `rumAuth` value.  Please do not paste any other access token or auth value into here, as this 
   * will be visible to every user of your app 
   * */
  rumAuth: string;
}

type SplunkOtelWeb = {
  deinit: () => void;
  init: (options: SplunkOtelWebOptions) => void;
  provider?: WebTracerProvider;
  setGlobalAttributes: (attributes: SpanAttributes) => void;
}

declare const SplunkOtelWebSingleton: SplunkOtelWeb;
export default SplunkOtelWebSingleton;
