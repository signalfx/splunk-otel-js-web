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

import './polyfill-safari10';
import { InstrumentationConfig, registerInstrumentations } from '@opentelemetry/instrumentation';
import { ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor, ReadableSpan, SpanExporter } from '@opentelemetry/tracing';
import { diag, DiagConsoleLogger, DiagLogLevel, SpanAttributes } from '@opentelemetry/api';
import { SplunkDocumentLoadInstrumentation } from './SplunkDocumentLoadInstrumentation';
import { SplunkXhrPlugin } from './SplunkXhrPlugin';
import { SplunkFetchInstrumentation } from './SplunkFetchInstrumentation';
import {
  SplunkUserInteractionInstrumentation,
  SplunkUserInteractionInstrumentationConfig,
  DEFAULT_AUTO_INSTRUMENTED_EVENTS,
  UserInteractionEventsConfig,
} from './SplunkUserInteractionInstrumentation';
import { SplunkExporter, SplunkExporterConfig } from './SplunkExporter';
import { ERROR_INSTRUMENTATION_NAME, SplunkErrorInstrumentation } from './SplunkErrorInstrumentation';
import { generateId, getPluginConfig } from './utils';
import { initSessionTracking } from './session';
import { SplunkWebSocketInstrumentation } from './SplunkWebSocketInstrumentation';
import { initWebVitals } from './webvitals';
import { SplunkLongTaskInstrumentation } from './SplunkLongTaskInstrumentation';
import {
  SplunkPostDocLoadResourceInstrumentation,
  SplunkPostDocLoadResourceInstrumentationConfig,
} from './SplunkPostDocLoadResourceInstrumentation';
import { SplunkWebTracerProvider } from './SplunkWebTracerProvider';
import { FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentationConfig } from '@opentelemetry/instrumentation-xml-http-request';

export * from './SplunkExporter';
export * from './SplunkWebTracerProvider';

interface SplunkOtelWebOptionsInstrumentations {
  document?:     boolean | InstrumentationConfig;
  errors?:       boolean;
  fetch?:        boolean | FetchInstrumentationConfig;
  interactions?: boolean | SplunkUserInteractionInstrumentationConfig;
  longtask?:     boolean | InstrumentationConfig;
  postload?:     boolean | SplunkPostDocLoadResourceInstrumentationConfig;
  websocket?:    boolean | InstrumentationConfig;
  webvitals?:    boolean;
  xhr?:          boolean | XMLHttpRequestInstrumentationConfig;
}

export interface SplunkOtelWebExporterOptions {
  /**
   * Allows remapping Span's attributes right before they're serialized.
   * One potential use case of this method is to remove PII from the attributes.
   */
  onAttributesSerializing?: (attributes: SpanAttributes, span: ReadableSpan) => SpanAttributes;
}

export interface SplunkOtelWebConfig {
  /** Allows http beacon urls */
  allowInsecureBeacon?: boolean;

  /** Application name */
  app: string;

  /** Destination for the captured data */
  beaconUrl: string | undefined;

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
  ignoreUrls?: Array<string | RegExp>;

  /** Configuration for instrumentation modules. */
  instrumentations?: SplunkOtelWebOptionsInstrumentations;

  /**
   * Publicly-visible `rumAuth` value.  Please do not paste any other access token or auth value into here, as this
   * will be visible to every user of your app
   * */
  rumAuth: string | undefined;
}

interface SplunkOtelWebConfigInternal extends SplunkOtelWebConfig {
  bufferSize?: number;
  bufferTimeout?: number;

  exporter?: SplunkOtelWebExporterOptions & {
    _factory?: (config: SplunkExporterConfig) => SpanExporter;
  };
}

// note: underscored fields are considered internal
const OPTIONS_DEFAULTS: SplunkOtelWebConfigInternal = {
  app: 'unknown-browser-app',
  beaconUrl: undefined,
  bufferTimeout: 5000, //millis, tradeoff between batching and loss of spans by not sending before page close
  bufferSize: 20, // spans, tradeoff between batching and hitting sendBeacon invididual limits
  instrumentations: {},
  exporter: {
    _factory: (options) => new SplunkExporter(options),
  },
  rumAuth: undefined,
};

const INSTRUMENTATIONS = [
  { Instrument: SplunkDocumentLoadInstrumentation, confKey: 'document', disable: false },
  { Instrument: SplunkXhrPlugin, confKey: 'xhr', disable: false },
  { Instrument: SplunkUserInteractionInstrumentation, confKey: 'interactions', disable: false },
  { Instrument: SplunkPostDocLoadResourceInstrumentation, confKey: 'postload', disable: false },
  { Instrument: SplunkFetchInstrumentation, confKey: 'fetch', disable: false },
  { Instrument: SplunkWebSocketInstrumentation, confKey: 'websocket', disable: true },
  { Instrument: SplunkLongTaskInstrumentation, confKey: 'longtask', disable: false },
  { Instrument: SplunkErrorInstrumentation, confKey: ERROR_INSTRUMENTATION_NAME, disable: false },
] as const;

export const INSTRUMENTATIONS_ALL_DISABLED: SplunkOtelWebOptionsInstrumentations = INSTRUMENTATIONS
  .map(instrumentation => instrumentation.confKey)
  .reduce(
    (acc, key) => { acc[key] = false; return acc; },
    { 'webvitals': false },
  );

const NOOP = () => {};

function buildExporter(options) {
  const completeUrl = options.beaconUrl + (options.rumAuth ? '?auth='+options.rumAuth : '');
  return options.exporter._factory({
    beaconUrl: completeUrl,
    onAttributesSerializing: options.exporter.onAttributesSerializing,
  });
}

interface SplunkOtelWebType {
  deinit: () => void;
  error: (...args: Array<any>) => void;
  init: (options: SplunkOtelWebConfig) => void;

  /**
   * Allows experimental options to be passed. No versioning guarantees are given for this method.
   */
  _internalInit: (options: SplunkOtelWebConfigInternal) => void;

  provider?: SplunkWebTracerProvider;
  setGlobalAttributes: (attributes: SpanAttributes) => void;
  DEFAULT_AUTO_INSTRUMENTED_EVENTS: UserInteractionEventsConfig;
  readonly inited: boolean;
}

let inited = false;
let _deregisterInstrumentations = NOOP;
let _errorInstrumentation: SplunkErrorInstrumentation | undefined;
const SplunkRum: SplunkOtelWebType = {
  DEFAULT_AUTO_INSTRUMENTED_EVENTS,

  get inited(): boolean {
    return inited;
  },

  _internalInit: function (options: SplunkOtelWebConfigInternal) {
    SplunkRum.init(options);
  },

  init: function (options) {
    diag.setLogger(new DiagConsoleLogger(), options?.debug ? DiagLogLevel.DEBUG : DiagLogLevel.ERROR);

    const processedOptions: SplunkOtelWebConfigInternal = Object.assign(
      {},
      OPTIONS_DEFAULTS,
      options,
      {
        exporter: Object.assign({}, OPTIONS_DEFAULTS.exporter, options.exporter),
      },
    );

    if (inited) {
      diag.error('SplunkRum already init()ed.');
      return;
    }

    if (!processedOptions.debug) {
      if (!processedOptions.beaconUrl) {
        throw new Error('SplunkRum.init( {beaconUrl: \'https://something\'} ) is required.');
      } else if(!processedOptions.beaconUrl.startsWith('https') && !processedOptions.allowInsecureBeacon) {
        throw new Error('Not using https is unsafe, if you want to force it use allowInsecureBeacon option.');
      }
      if (!processedOptions.rumAuth) {
        diag.warn('rumAuth will be required in the future');
      }
    }

    const instanceId = generateId(64);
    initSessionTracking(instanceId, processedOptions.cookieDomain);

    const { ignoreUrls, app, environment } = processedOptions;
    // enabled: false prevents registerInstrumentations from enabling instrumentations in constructor
    // they will be enabled in registerInstrumentations
    const pluginDefaults = { ignoreUrls, enabled: false };

    const provider = new SplunkWebTracerProvider({
      app,
      instanceId,
      globalAttributes: {
        ...environment ? { environment } : {},
        ...processedOptions.globalAttributes || {},
      },
    });
    const instrumentations = INSTRUMENTATIONS.map(({ Instrument, confKey, disable }) => {
      const pluginConf = getPluginConfig(processedOptions.instrumentations[confKey], pluginDefaults, disable);
      if (pluginConf) {
        const instrumentation = new Instrument(pluginConf);
        if (confKey === ERROR_INSTRUMENTATION_NAME && instrumentation instanceof SplunkErrorInstrumentation) {
          _errorInstrumentation = instrumentation;
        }
        return instrumentation;
      }

      return null;
    }).filter(a => a);

    _deregisterInstrumentations = registerInstrumentations({
      tracerProvider: provider,
      instrumentations,
    });

    if (processedOptions.beaconUrl) {
      const exporter = buildExporter(processedOptions);
      const batchSpanProcessor = new BatchSpanProcessor(exporter, {
        scheduledDelayMillis: processedOptions.bufferTimeout,
        maxExportBatchSize: processedOptions.bufferSize,
        maxQueueSize: 2 * processedOptions.bufferSize,
      });
      window.addEventListener('visibilitychange', function() {
        // this condition applies when the page is hidden or when it's closed
        // see for more details: https://developers.google.com/web/updates/2018/07/page-lifecycle-api#developer-recommendations-for-each-state
        if (document.visibilityState === 'hidden') {
          batchSpanProcessor.forceFlush();
        }
      });
      provider.addSpanProcessor(batchSpanProcessor);
      this._processor = batchSpanProcessor;
    }
    if (processedOptions.debug) {
      provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }

    provider.register();
    this.provider = provider;

    const vitalsConf = getPluginConfig(processedOptions.instrumentations.webvitals);
    if (vitalsConf !== false) {
      initWebVitals(provider);
    }

    inited = true;
    diag.info('SplunkRum.init() complete');
  },

  deinit() {
    if (!inited) {
      return;
    }
    _deregisterInstrumentations();
    _deregisterInstrumentations = NOOP;

    this.provider.shutdown();
    delete this.provider;
    diag.disable();

    inited = false;
  },

  setGlobalAttributes(attributes) {
    this.provider?.setGlobalAttributes(attributes);
  },

  error(...args) {
    if (!_errorInstrumentation) {
      diag.error('Error was reported, but error instrumentation is disabled.');
      return;
    }

    _errorInstrumentation.report('SplunkRum.error', args);
  }
};

export default SplunkRum;
