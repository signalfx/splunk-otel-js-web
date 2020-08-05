import {ConsoleSpanExporter, SimpleSpanProcessor} from '@opentelemetry/tracing';
import {WebTracerProvider} from '@opentelemetry/web';
import {SplunkDocumentLoad} from './docload';
import {SplunkXhrPlugin} from './xhrfetch';
import {SplunkFetchPlugin} from './xhrfetch';
import {SplunkUserInteractionPlugin} from "./interaction";
import {PatchedZipkinExporter} from './zipkin';
import {captureErrors} from "./errors";
import {findCookieValue, generateId} from "./utils";
import {version as SplunkRumVersion} from "../package.json";

if (!window.SplunkRum) {
  window.SplunkRum = {
    inited: false
  };

  window.SplunkRum.init = function (options) {
    if (this.inited) {
      console.log("SplunkRum already init()ed.");
      return;
    }
    if (!options.beaconUrl) {
      // FIXME error handling
      console.log("SplunkRum.init( {beaconUrl: 'https://something'} ) is required.");
      return;
    }
    const app = options.app || 'unknown-browser-app';

    const instanceId = generateId(64);

    const cookieName = "_splunk_rum_sid";

    if (!document.cookie.includes(cookieName)) {
      var sessionId = generateId(128);
      document.cookie = cookieName + '=' + sessionId + "; path=/";
    }
    const rumSessionId = findCookieValue(cookieName);

    // FIXME this is still not the cleanest way to add an attribute to all created spans..,
    class PatchedWTP extends WebTracerProvider {
      constructor(config) {
        super(config);
      }

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
          span.setAttribute('splunk.scriptInstance', instanceId)
          return span;
        }
        return tracer;
      }
    }


    // A random place to list a bunch of items that are unresolved
    // FIXME is there any way to tell that a resource load failed from its performance entry?
    // FIXME longtask
    // FIXME repo/licensing issues
    // FIXME strip http.user_agent from spans as redundant
    // FIXME rumKey


    const provider = new PatchedWTP({
      plugins: [
        new SplunkDocumentLoad(),
        new SplunkXhrPlugin(),
        new SplunkFetchPlugin(),
        new SplunkUserInteractionPlugin(),
      ],
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(new PatchedZipkinExporter(options.beaconUrl)));
    if (options.debug) {
      provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }
    provider.register();
    Object.defineProperty(this, '_provider', {value:provider});
    if (options.captureErrors === undefined || options.captureErrors === true) {
      captureErrors(this, provider); // also registers SplunkRum.error
    } else {
      // stub out error reporting method to not break apps that call it
      this.error = function() { }
    }
    this.inited = true;
    console.log('SplunkRum.init() complete');
  };
}
