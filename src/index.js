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
import {WebTracerProvider} from '@opentelemetry/web';
import {DiagLogLevel} from '@opentelemetry/api';
import {SplunkDocumentLoad} from './docload';
import {SplunkXhrPlugin, SplunkFetchInstrumentation} from './xhrfetch';
import {SplunkUserInteractionInstrumentation, DEFAULT_AUTO_INSTRUMENTED_EVENTS} from './interaction';
import {PatchedZipkinExporter} from './zipkin';
import {captureErrors} from './errors';
import {generateId, getPluginConfig} from './utils';
import {initSessionTracking, getRumSessionId} from './session';
import {version as SplunkRumVersion} from '../package.json';
import {SplunkWebSocketInstrumentation} from './websocket';
import { initWebVitals } from './webvitals';
import { SplunkLongTaskInstrumentation } from './longtask';
import { PostDocLoadResourceObserver } from './postDocLoadResourceObserver.js';

const OPTIONS_DEFAULTS = {
  app: 'unknown-browser-app',
  bufferTimeout: 5000, //millis, tradeoff between batching and loss of spans by not sending before page close
  bufferSize: 20, // spans, tradeoff between batching and hitting sendBeacon invididual limits
  instrumentations: {},
};

const INSTRUMENTATIONS = [
  {Instrument: SplunkDocumentLoad, confKey: 'document'},
  {Instrument: SplunkXhrPlugin, confKey: 'xhr'},
  {Instrument: SplunkUserInteractionInstrumentation, confKey: 'interactions'},
  {Instrument: PostDocLoadResourceObserver, confKey: 'postload'},
  {Instrument: SplunkFetchInstrumentation, confKey: 'xhr'},
  {Instrument: SplunkWebSocketInstrumentation, confKey: 'websocket', disable: true},
  {Instrument: SplunkLongTaskInstrumentation, confKey: 'longtask'},
];

const NOOP = () => {};

const SplunkRum = {
  inited: false,
  _deregisterInstrumentations: NOOP,
  DEFAULT_AUTO_INSTRUMENTED_EVENTS,
  init: function (options = {}) {
    options = Object.assign({}, OPTIONS_DEFAULTS, options);

    if (this.inited) {
      console.log('SplunkRum already init()ed.');
      return;
    }

    if (!options.debug) {
      if (!options.beaconUrl) {
        throw new Error('SplunkRum.init( {beaconUrl: \'https://something\'} ) is required.');
      } else if(!options.beaconUrl.startsWith('https') && !options.allowInsecureBeacon) {
        throw new Error('Not using https is unsafe, if you want to force it use allowInsecureBeacon option.');
      }
      if (!options.rumAuth) {
        console.log('rumAuth will be required in the future');
      }
    }
    const { app } = options;

    const instanceId = generateId(64);

    initSessionTracking(instanceId);

    let globalAttributes = {};
    this.setGlobalAttributes = function(attributes) {
      globalAttributes = typeof attributes === 'object' ? attributes : {};
      if (options.environment) {
        globalAttributes['environment'] = options.environment;
      }
    };
    this.setGlobalAttributes(options.globalAttributes);

    // FIXME this is still not the cleanest way to add an attribute to all created spans..,
    class PatchedWTP extends WebTracerProvider {
      getTracer(name, version, config) {
        const tracer = super.getTracer(name, version, config);
        const origStartSpan = tracer.startSpan;
        tracer.startSpan = function () {
          const span = origStartSpan.apply(tracer, arguments);
          span.setAttribute('location.href', location.href);
          // FIXME does otel want this stuff in Resource?
          span.setAttribute('splunk.rumSessionId', getRumSessionId());
          span.setAttribute('splunk.rumVersion', SplunkRumVersion);
          span.setAttribute('app', app);
          span.setAttribute('splunk.scriptInstance', instanceId);
          if (globalAttributes) {
            span.setAttributes(globalAttributes);
          }
          return span;
        };
        return tracer;
      }
    }

    const { ignoreUrls } = options;
    
    // enabled: false prevents registerInstrumentations from enabling instrumentations in constructor
    // they will be enabled in registerInstrumentations
    const pluginDefaults = { ignoreUrls, enabled: false };
    
    const provider = new PatchedWTP({
      logLevel: options.debug ? DiagLogLevel.DEBUG : DiagLogLevel.ERROR,
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

    if (options.spanProcessor) {
      const sp = options.spanProcessor;
      if (typeof sp.onStart === 'function' && typeof sp.onEnd === 'function') {
        provider.addSpanProcessor(sp);
      }
    }

    if (options.beaconUrl) {
      const completeUrl = options.beaconUrl + (options.rumAuth ? '?auth='+options.rumAuth : '');
      const batchSpanProcessor = new BatchSpanProcessor(new PatchedZipkinExporter(completeUrl), {
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
    console.log('SplunkRum.init() complete');
  },

  deinit() {
    if (!this.inited) {
      return;
    }
    this._deregisterInstrumentations();
    this._deregisterInstrumentations = NOOP;
    
    this.provider.shutdown();
    delete this.provider;

    this.inited = false;
  },
};

export default SplunkRum;
