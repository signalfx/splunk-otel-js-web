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
import {registerInstrumentations} from '@opentelemetry/instrumentation';
import {ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor} from '@opentelemetry/tracing';
import {diag, DiagConsoleLogger, DiagLogLevel} from '@opentelemetry/api';
import {SplunkDocumentLoad} from './docload';
import {SplunkXhrPlugin, SplunkFetchInstrumentation} from './xhrfetch';
import {SplunkUserInteractionInstrumentation, DEFAULT_AUTO_INSTRUMENTED_EVENTS} from './interaction';
import {SplunkExporter} from './SplunkExporter';
import {captureErrors} from './errors';
import {generateId, getPluginConfig} from './utils';
import {initSessionTracking} from './session';
import {SplunkWebSocketInstrumentation} from './websocket';
import { initWebVitals } from './webvitals';
import { SplunkLongTaskInstrumentation } from './longtask';
import { PostDocLoadResourceObserver } from './postDocLoadResourceObserver.js';
import { SplunkWebTracerProvider } from './SplunkWebTracerProvider';

export * from './SplunkExporter';
export * from './SplunkWebTracerProvider';

// note: underscored fields are considered internal
const OPTIONS_DEFAULTS = {
  app: 'unknown-browser-app',
  bufferTimeout: 5000, //millis, tradeoff between batching and loss of spans by not sending before page close
  bufferSize: 20, // spans, tradeoff between batching and hitting sendBeacon invididual limits
  instrumentations: {},
  exporter: {
    _factory: (options) => new SplunkExporter(options),
    onAttributesSerializing: undefined,
  },
};

const INSTRUMENTATIONS = [
  {Instrument: SplunkDocumentLoad, confKey: 'document'},
  {Instrument: SplunkXhrPlugin, confKey: 'xhr'},
  {Instrument: SplunkUserInteractionInstrumentation, confKey: 'interactions'},
  {Instrument: PostDocLoadResourceObserver, confKey: 'postload'},
  {Instrument: SplunkFetchInstrumentation, confKey: 'fetch'},
  {Instrument: SplunkWebSocketInstrumentation, confKey: 'websocket', disable: true},
  {Instrument: SplunkLongTaskInstrumentation, confKey: 'longtask'},
];

export const INSTRUMENTATIONS_ALL_DISABLED = INSTRUMENTATIONS
  .map(instrumentation => instrumentation.confKey)
  .concat(['webvitals', 'errors'])
  .reduce((acc, key) => { acc[key] = false; return acc; }, {});

const NOOP = () => {};

function buildExporter(options) {
  const completeUrl = options.beaconUrl + (options.rumAuth ? '?auth='+options.rumAuth : '');
  return options.exporter._factory({
    beaconUrl: completeUrl,
    onAttributesSerializing: options.exporter.onAttributesSerializing,
  });
}

const SplunkRum = {
  inited: false,
  _deregisterInstrumentations: NOOP,
  DEFAULT_AUTO_INSTRUMENTED_EVENTS,
  init: function (options = {}) {
    diag.setLogger(new DiagConsoleLogger(), options.debug ? DiagLogLevel.DEBUG : DiagLogLevel.ERROR);

    options = Object.assign({}, OPTIONS_DEFAULTS, options, {
      exporter: Object.assign({}, OPTIONS_DEFAULTS.exporter, options.exporter),
    });

    if (this.inited) {
      diag.error('SplunkRum already init()ed.');
      return;
    }

    if (!options.debug) {
      if (!options.beaconUrl) {
        throw new Error('SplunkRum.init( {beaconUrl: \'https://something\'} ) is required.');
      } else if(!options.beaconUrl.startsWith('https') && !options.allowInsecureBeacon) {
        throw new Error('Not using https is unsafe, if you want to force it use allowInsecureBeacon option.');
      }
      if (!options.rumAuth) {
        diag.warn('rumAuth will be required in the future');
      }
    }

    const instanceId = generateId(64);
    initSessionTracking(instanceId, options.cookieDomain);

    const { ignoreUrls, app, environment } = options;
    // enabled: false prevents registerInstrumentations from enabling instrumentations in constructor
    // they will be enabled in registerInstrumentations
    const pluginDefaults = { ignoreUrls, enabled: false };

    const provider = new SplunkWebTracerProvider({
      app,
      instanceId,
      globalAttributes: {
        ...environment ? { environment } : {},
        ...options.globalAttributes || {},
      },
    });
    const instrumentations = INSTRUMENTATIONS.map(({Instrument, confKey, disable}) => {
      const pluginConf = getPluginConfig(options.instrumentations[confKey], pluginDefaults, disable);
      if (pluginConf) {
        return new Instrument(pluginConf);
      }

      return null;
    }).filter(a => a);

    this._deregisterInstrumentations = registerInstrumentations({
      tracerProvider: provider,
      instrumentations,
    });

    if (options.beaconUrl) {
      const exporter = buildExporter(options);
      const batchSpanProcessor = new BatchSpanProcessor(exporter, {
        scheduledDelayMillis: options.bufferTimeout,
        maxExportBatchSize: options.bufferSize,
        maxQueueSize: 2 * options.bufferSize,
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
    if (options.debug) {
      provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }

    provider.register();
    this.provider = provider;

    const errorsConf = getPluginConfig(options.instrumentations.errors);
    if (errorsConf !== false) {
      captureErrors(this, provider); // also registers SplunkRum.error
    } else {
      // stub out error reporting method to not break apps that call it
      this.error = function() { };
    }

    const vitalsConf = getPluginConfig(options.instrumentations.webvitals);
    if (vitalsConf !== false) {
      initWebVitals(provider);
    }

    this.inited = true;
    diag.info('SplunkRum.init() complete');
  },

  deinit() {
    if (!this.inited) {
      return;
    }
    this._deregisterInstrumentations();
    this._deregisterInstrumentations = NOOP;

    this.provider.shutdown();
    delete this.provider;
    diag.disable();

    this.inited = false;
  },

  setGlobalAttributes(attributes) {
    this.provider?.setGlobalAttributes(attributes);
  }
};

export default SplunkRum;
