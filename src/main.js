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

import './oldBrowserSupportCheck.js';
import {ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor} from '@opentelemetry/tracing';
import {NoopTracerProvider} from '@opentelemetry/api';
import {WebTracerProvider} from '@opentelemetry/web';
import {LogLevel} from '@opentelemetry/core';
import {SplunkDocumentLoad} from './docload';
import {SplunkXhrPlugin, SplunkFetchInstrumentation} from './xhrfetch';
import {SplunkUserInteractionPlugin, DEFAULT_AUTO_INSTRUMENTED_EVENTS} from './interaction';
import {PatchedZipkinExporter} from './zipkin';
import {captureErrors} from './errors';
import {generateId} from './utils';
import {initSessionTracking, getRumSessionId} from './session';
import {version as SplunkRumVersion} from '../package.json';
import {WebSocketInstrumentation} from './websocket';
import { initWebVitals } from './webvitals';
import { SplunkLongTaskInstrumentation } from './longtask';
import { PostDocLoadResourceObserver } from './postDocLoadResourceObserver.js';

function browserSupported() {
  // FIXME very short-term patch for Safari 10.1 -> upstream fixes pending
  return window.PerformanceObserver && performance.getEntriesByType;
}

const OPTIONS_DEFAULTS = {
  app: 'unknown-browser-app',
  adjustAutoInstrumentedEvents: {},
};

if (!window.SplunkRum) {
  window.SplunkRum = {
    inited: false,
    DEFAULT_AUTO_INSTRUMENTED_EVENTS,
  };

  window.SplunkRum.init = function (options = {}) {
    options = Object.assign({}, OPTIONS_DEFAULTS, options);

    if (this.inited) {
      console.log('SplunkRum already init()ed.');
      return;
    }

    if (!browserSupported()) {
      console.log('SplunkRum: browser not supported, disabling instrumentation.');
      window.SplunkRum.error = function() {};
      window.SplunkRum.provider = new NoopTracerProvider();
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

    const { ignoreUrls, adjustAutoInstrumentedEvents } = options;
    const pluginConf = { ignoreUrls };
    const provider = new PatchedWTP({
      plugins: [
        new SplunkDocumentLoad(),
        new SplunkXhrPlugin(pluginConf),
        new SplunkUserInteractionPlugin({ adjustAutoInstrumentedEvents }),
      ],
      logLevel: options.debug ? LogLevel.DEBUG : LogLevel.ERROR,
    });
    if (options.spanProcessor) {
      const sp = options.spanProcessor;
      if (typeof sp.onStart === 'function' && typeof sp.onEnd === 'function') {
        provider.addSpanProcessor(sp);
      }
    }
    
    new WebSocketInstrumentation(provider, pluginConf).patch();
    
    const fetchInstrumentation = new SplunkFetchInstrumentation(pluginConf);
    fetchInstrumentation.setTracerProvider(provider);
    fetchInstrumentation.enable();

    const longtaskInstrumentation = new SplunkLongTaskInstrumentation();
    longtaskInstrumentation.setTracerProvider(provider);
   
    if (options.allowedInitiatorTypes) {
      pluginConf.allowedInitiatorTypes = options.allowedInitiatorTypes;
    }
    new PostDocLoadResourceObserver(pluginConf).setTracerProvider(provider);

    if (options.beaconUrl) {
      const completeUrl = options.beaconUrl + (options.rumAuth ? '?auth='+options.rumAuth : '');
      const bufferTimeout = typeof options.bufferTimeout !== 'undefined' 
        ? Number(options.bufferTimeout)
        : 5000; //millis, tradeoff between batching and loss of spans by not sending before page close
      const batchSpanProcessor = new BatchSpanProcessor(new PatchedZipkinExporter(completeUrl), {
        // This number is still an experiment, probably not the final number yet.
        bufferTimeout,
        bufferSize: 20, // spans, tradeoff between batching and hitting sendBeacon invididual limits
      });
      window.addEventListener('visibilitychange', function() {
        // this condition applies when the page is hidden or when it's closed
        // see for more details: https://developers.google.com/web/updates/2018/07/page-lifecycle-api#developer-recommendations-for-each-state
        if (document.visibilityState === 'hidden') {
          batchSpanProcessor.forceFlush();
        }
      });
      provider.addSpanProcessor(batchSpanProcessor);
    }
    if (options.debug) {
      provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }
    provider.register();
    Object.defineProperty(this, 'provider', {value:provider, configurable: true});
    if (options.captureErrors === undefined || options.captureErrors === true) {
      captureErrors(this, provider); // also registers SplunkRum.error
    } else {
      // stub out error reporting method to not break apps that call it
      this.error = function() { };
    }
    initWebVitals(provider);
    this.inited = true;
    console.log('SplunkRum.init() complete');
  };
}
