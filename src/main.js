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

import {ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor} from '@opentelemetry/tracing';
import {NoopTracerProvider} from '@opentelemetry/api';
import {WebTracerProvider} from '@opentelemetry/web';
import {LogLevel} from '@opentelemetry/core';
import {SplunkDocumentLoad} from './docload';
import {SplunkXhrPlugin, SplunkFetchPlugin} from './xhrfetch';
import {SplunkUserInteractionPlugin} from './interaction';
import {PatchedZipkinExporter} from './zipkin';
import {captureErrors} from './errors';
import {findCookieValue, generateId, isIframe} from './utils';
import {version as SplunkRumVersion} from '../package.json';
import {WebSocketInstrumentation} from './websocket';
import { initWebVitals } from './webvitals';

function browserSupported() {
  // FIXME very short-term patch for Safari 10.1 -> upstream fixes pending
  return window.PerformanceObserver && performance.getEntriesByType;
}

if (!window.SplunkRum) {
  window.SplunkRum = {
    inited: false
  };

  window.SplunkRum.init = function (options) {
    // Check more frequently in the case of SPA/long-lived document
    const SessionTimeoutSeconds = 24 * 60 * 60;
    const SessionTimeoutCheckSeconds = 60 * 60;

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
    const app = options.app || 'unknown-browser-app';

    const instanceId = generateId(64);


    const cookieName = '_splunk_rum_sid';

    let rumSessionId = instanceId;
    const cookieSetter = function() {
      if (!document.cookie.includes(cookieName)) {
        const sessionId = generateId(128);
        let cookie = cookieName + '=' + sessionId + '; path=/; max-age=' + SessionTimeoutSeconds ;

        if (isIframe()) {
          cookie += ';SameSite=None; Secure';
        } else {
          cookie += ';SameSite=Strict';
        }
        document.cookie = cookie;
        setTimeout(cookieSetter, 1000*SessionTimeoutCheckSeconds);
      }
      const sessionIdFromCookie = findCookieValue(cookieName);
      if (sessionIdFromCookie) {
        rumSessionId = sessionIdFromCookie;
      }
    };
    cookieSetter();

    let globalAttributes = options.globalAttributes && typeof options.globalAttributes === 'object' ? options.globalAttributes : undefined;
    this.setGlobalAttributes = function(attributes) {
      globalAttributes = typeof attributes === 'object' ? attributes : undefined;
    };

    // FIXME this is still not the cleanest way to add an attribute to all created spans..,
    class PatchedWTP extends WebTracerProvider {
      getTracer(name, version, config) {
        const tracer = super.getTracer(name, version, config);
        const origStartSpan = tracer.startSpan;
        tracer.startSpan = function () {
          const span = origStartSpan.apply(tracer, arguments);
          span.setAttribute('location.href', location.href);
          // FIXME does otel want this stuff in Resource?
          span.setAttribute('splunk.rumSessionId', rumSessionId);
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

    const pluginConf = options.ignoreUrls ? {ignoreUrls: options.ignoreUrls} : {};
    const provider = new PatchedWTP({
      plugins: [
        new SplunkDocumentLoad(),
        new SplunkXhrPlugin(pluginConf),
        new SplunkFetchPlugin(pluginConf),
        new SplunkUserInteractionPlugin(),
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
