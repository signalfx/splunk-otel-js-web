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
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ReadableSpan,
  SpanExporter,
  SpanProcessor,
  BufferConfig,
} from '@opentelemetry/sdk-trace-base';
import { WebTracerConfig } from '@opentelemetry/sdk-trace-web';
import { Attributes, diag, DiagConsoleLogger, DiagLogLevel, SpanAttributes } from '@opentelemetry/api';
import { SplunkDocumentLoadInstrumentation } from './SplunkDocumentLoadInstrumentation';
import { SplunkXhrPlugin } from './SplunkXhrPlugin';
import { SplunkFetchInstrumentation } from './SplunkFetchInstrumentation';
import {
  SplunkUserInteractionInstrumentation,
  SplunkUserInteractionInstrumentationConfig,
  DEFAULT_AUTO_INSTRUMENTED_EVENTS,
  DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES,
  UserInteractionEventsConfig,
} from './SplunkUserInteractionInstrumentation';
import { SplunkExporter, SplunkExporterConfig } from './SplunkExporter';
import { ERROR_INSTRUMENTATION_NAME, SplunkErrorInstrumentation } from './SplunkErrorInstrumentation';
import { generateId, getPluginConfig } from './utils';
import { getRumSessionId, initSessionTracking, SessionIdType } from './session';
import { SplunkWebSocketInstrumentation } from './SplunkWebSocketInstrumentation';
import { initWebVitals } from './webvitals';
import { SplunkLongTaskInstrumentation } from './SplunkLongTaskInstrumentation';
import { SplunkPageVisibilityInstrumentation } from './SplunkPageVisibilityInstrumentation';
import { SplunkConnectivityInstrumentation } from './SplunkConnectivityInstrumentation';
import {
  SplunkPostDocLoadResourceInstrumentation,
  SplunkPostDocLoadResourceInstrumentationConfig,
} from './SplunkPostDocLoadResourceInstrumentation';
import { SplunkWebTracerProvider } from './SplunkWebTracerProvider';
import { FetchInstrumentationConfig } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentationConfig } from '@opentelemetry/instrumentation-xml-http-request';
import {
  InternalEventTarget,
  SplunkOtelWebEventTarget,
} from './EventTarget';
import { ContextManagerConfig, SplunkContextManager } from './SplunkContextManager';
import { Resource, ResourceAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { AlwaysOffSampler, AlwaysOnSampler, ParentBasedSampler, SDK_INFO } from '@opentelemetry/core';
import { VERSION } from './version';
import { getSyntheticsRunId, SYNTHETICS_RUN_ID_ATTRIBUTE } from './synthetics';
import { SplunkSpanAttributesProcessor } from './SplunkSpanAttributesProcessor';
import { SessionBasedSampler } from './SessionBasedSampler';
import { SocketIoClientInstrumentationConfig, SplunkSocketIoClientInstrumentation } from './SplunkSocketIoClientInstrumentation';

export * from './SplunkExporter';
export * from './SplunkWebTracerProvider';
export * from './SessionBasedSampler';

interface SplunkOtelWebOptionsInstrumentations {
  document?:     boolean | InstrumentationConfig;
  errors?:       boolean;
  fetch?:        boolean | FetchInstrumentationConfig;
  interactions?: boolean | SplunkUserInteractionInstrumentationConfig;
  longtask?:     boolean | InstrumentationConfig;
  visibility?:   boolean | InstrumentationConfig;
  connectivity?: boolean | InstrumentationConfig;
  postload?:     boolean | SplunkPostDocLoadResourceInstrumentationConfig;
  socketio?:     boolean | SocketIoClientInstrumentationConfig;
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

  /** Options for context manager */
  context?: ContextManagerConfig;

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

  /**
   * Config options passed to web tracer
   */
  tracer?: WebTracerConfig;
}

interface SplunkOtelWebConfigInternal extends SplunkOtelWebConfig {
  bufferSize?: number;
  bufferTimeout?: number;

  exporter: SplunkOtelWebExporterOptions & {
    factory: (config: SplunkExporterConfig) => SpanExporter;
  };

  spanProcessor: {
    factory: <T extends BufferConfig> (exporter: SpanExporter, config: T) => SpanProcessor;
  };
}

const OPTIONS_DEFAULTS: SplunkOtelWebConfigInternal = {
  app: 'unknown-browser-app',
  beaconUrl: undefined,
  bufferTimeout: 5000, //millis, tradeoff between batching and loss of spans by not sending before page close
  bufferSize: 20, // spans, tradeoff between batching and hitting sendBeacon invididual limits
  instrumentations: {},
  exporter: {
    factory: (options) => new SplunkExporter(options),
  },
  spanProcessor: {
    factory: (exporter, config) => new BatchSpanProcessor(exporter, config),
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
  { Instrument: SplunkPageVisibilityInstrumentation, confKey: 'visibility', disable: true },
  { Instrument: SplunkConnectivityInstrumentation, confKey: 'connectivity', disable: true },
  { Instrument: SplunkSocketIoClientInstrumentation, confKey: 'socketio', disable: true },
] as const;

export const INSTRUMENTATIONS_ALL_DISABLED: SplunkOtelWebOptionsInstrumentations = INSTRUMENTATIONS
  .map(instrumentation => instrumentation.confKey)
  .reduce(
    (acc, key) => { acc[key] = false; return acc; },
    { 'webvitals': false },
  );

function buildExporter(options) {
  const completeUrl = options.beaconUrl + (options.rumAuth ? '?auth='+options.rumAuth : '');
  return options.exporter.factory({
    beaconUrl: completeUrl,
    onAttributesSerializing: options.exporter.onAttributesSerializing,
  });
}

export interface SplunkOtelWebType extends SplunkOtelWebEventTarget {
  deinit: () => void;

  error: (...args: Array<any>) => void;

  init: (options: SplunkOtelWebConfig) => void;

  /**
   * Allows experimental options to be passed. No versioning guarantees are given for this method.
   */
  _internalInit: (options: Partial<SplunkOtelWebConfigInternal>) => void;

  provider?: SplunkWebTracerProvider;

  attributesProcessor?: SplunkSpanAttributesProcessor;

  setGlobalAttributes: (attributes: Attributes) => void;

  /**
   * This method provides access to computed, final value of global attributes, which are applied to all created spans.
   */
  getGlobalAttributes: () => Attributes;
  /**
   * @deprecated Use {@link getGlobalAttributes()}
   */
  _experimental_getGlobalAttributes: () => Attributes;

  /**
   * This method returns current session ID
   */
  getSessionId: () => SessionIdType;
  /**
   * @deprecated Use {@link getSessionId()}
   */
  _experimental_getSessionId: () => SessionIdType;

  DEFAULT_AUTO_INSTRUMENTED_EVENTS: UserInteractionEventsConfig;
  DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES: (keyof HTMLElementEventMap)[];

  AlwaysOnSampler: typeof AlwaysOnSampler;
  AlwaysOffSampler: typeof AlwaysOffSampler;
  ParentBasedSampler: typeof ParentBasedSampler;
  SessionBasedSampler: typeof SessionBasedSampler;

  readonly inited: boolean;
}

let inited = false;
let _deregisterInstrumentations: () => void | undefined;
let _deinitSessionTracking: () => void | undefined;
let _errorInstrumentation: SplunkErrorInstrumentation | undefined;
let _postDocLoadInstrumentation: SplunkPostDocLoadResourceInstrumentation | undefined;
let eventTarget: InternalEventTarget | undefined;
export const SplunkRum: SplunkOtelWebType = {
  DEFAULT_AUTO_INSTRUMENTED_EVENTS,
  DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES,

  // Re-export samplers as properties for easier use in CDN build
  AlwaysOnSampler,
  AlwaysOffSampler,
  ParentBasedSampler,
  SessionBasedSampler,

  get inited(): boolean {
    return inited;
  },

  _internalInit: function (options: Partial<SplunkOtelWebConfigInternal>) {
    SplunkRum.init({
      ...OPTIONS_DEFAULTS,
      ...options,
    });
  },

  init: function (options) {
    diag.setLogger(new DiagConsoleLogger(), options?.debug ? DiagLogLevel.DEBUG : DiagLogLevel.ERROR);
    eventTarget = new InternalEventTarget();

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
    _deinitSessionTracking = initSessionTracking(
      instanceId,
      eventTarget,
      processedOptions.cookieDomain,
    ).deinit;

    const { ignoreUrls, app, environment } = processedOptions;
    // enabled: false prevents registerInstrumentations from enabling instrumentations in constructor
    // they will be enabled in registerInstrumentations
    const pluginDefaults = { ignoreUrls, enabled: false };

    const resourceAttrs: ResourceAttributes = {
      ...SDK_INFO,
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: '@splunk/otel-web',
      [SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: VERSION,
      // Splunk specific attributes
      'splunk.rumVersion': VERSION,
      'splunk.scriptInstance': instanceId,
      'app': app,
    };
    Object.defineProperty(resourceAttrs, 'splunk.rumSessionId', {
      get() {
        return getRumSessionId();
      },
      configurable: true,
      enumerable: true,
    });

    const syntheticsRunId = getSyntheticsRunId();
    if (syntheticsRunId) {
      resourceAttrs[SYNTHETICS_RUN_ID_ATTRIBUTE] = syntheticsRunId;
    }

    const provider = new SplunkWebTracerProvider({
      ...processedOptions.tracer,
      resource: new Resource(resourceAttrs),
    });
    const instrumentations = INSTRUMENTATIONS.map(({ Instrument, confKey, disable }) => {
      const pluginConf = getPluginConfig(processedOptions.instrumentations[confKey], pluginDefaults, disable);
      if (pluginConf) {
        // @ts-expect-error Can't mark in any way that processedOptions.instrumentations[confKey] is of specifc config type
        const instrumentation = new Instrument(pluginConf);
        if (confKey === ERROR_INSTRUMENTATION_NAME && instrumentation instanceof SplunkErrorInstrumentation) {
          _errorInstrumentation = instrumentation;
        }
        if (confKey === 'postload' && instrumentation instanceof SplunkPostDocLoadResourceInstrumentation) {
          _postDocLoadInstrumentation = instrumentation;
        }
        return instrumentation;
      }

      return null;
    }).filter(a => a);

    this.attributesProcessor = new SplunkSpanAttributesProcessor({
      ...environment ? { environment } : {},
      ...processedOptions.globalAttributes || {},
    });
    provider.addSpanProcessor(this.attributesProcessor);

    if (processedOptions.beaconUrl) {
      const exporter = buildExporter(processedOptions);
      const spanProcessor = processedOptions.spanProcessor.factory(exporter, {
        scheduledDelayMillis: processedOptions.bufferTimeout,
        maxExportBatchSize: processedOptions.bufferSize,
      });
      provider.addSpanProcessor(spanProcessor);
      this._processor = spanProcessor;
    }
    if (processedOptions.debug) {
      provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }

    window.addEventListener('visibilitychange', () => {
      // this condition applies when the page is hidden or when it's closed
      // see for more details: https://developers.google.com/web/updates/2018/07/page-lifecycle-api#developer-recommendations-for-each-state
      if (document.visibilityState === 'hidden') {
        this._processor.forceFlush();
      }
    });

    provider.register({
      contextManager: new SplunkContextManager({
        ...processedOptions.context,
        onBeforeContextStart: () => _postDocLoadInstrumentation.onBeforeContextChange(),
        onBeforeContextEnd: () => _postDocLoadInstrumentation.onBeforeContextChange(),
      })
    });

    // After context manager registration so instrumentation event listeners are affected accordingly
    _deregisterInstrumentations = registerInstrumentations({
      tracerProvider: provider,
      instrumentations,
    });

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

    _deregisterInstrumentations?.();
    _deregisterInstrumentations = undefined;

    _deinitSessionTracking?.();
    _deinitSessionTracking = undefined;

    this.provider.shutdown();
    delete this.provider;
    eventTarget = undefined;
    diag.disable();

    inited = false;
  },

  setGlobalAttributes(this: SplunkOtelWebType, attributes?: Attributes) {
    this.attributesProcessor?.setGlobalAttributes(attributes);
    eventTarget?.emit('global-attributes-changed', {
      attributes: this.attributesProcessor?.getGlobalAttributes() || {},
    });
  },

  getGlobalAttributes(this: SplunkOtelWebType) {
    return this.attributesProcessor?.getGlobalAttributes() || {};
  },

  _experimental_getGlobalAttributes() {
    return this.getGlobalAttributes();
  },

  error(...args) {
    if (!_errorInstrumentation) {
      diag.error('Error was reported, but error instrumentation is disabled.');
      return;
    }

    _errorInstrumentation.report('SplunkRum.error', args);
  },

  addEventListener(name, callback): void {
    eventTarget?.addEventListener(name, callback);
  },

  removeEventListener(name, callback): void {
    eventTarget?.removeEventListener(name, callback);
  },

  _experimental_addEventListener(name, callback): void {
    return this.addEventListener(name, callback);
  },

  _experimental_removeEventListener(name, callback): void {
    return this.removeEventListener(name, callback);
  },

  getSessionId() {
    return getRumSessionId();
  },
  _experimental_getSessionId() {
    return this.getSessionId();
  },
};

export default SplunkRum;
