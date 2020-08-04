import {SimpleSpanProcessor} from '@opentelemetry/tracing';
import {WebTracerProvider} from '@opentelemetry/web';
import {SplunkDocumentLoad} from './docload';
import {SplunkXhrPlugin} from './xhrfetch';
import {SplunkFetchPlugin} from './xhrfetch';
import {UserInteractionPlugin} from '@opentelemetry/plugin-user-interaction';
import {PatchedZipkinExporter} from './zipkin';
import {captureErrors} from "./errors";
import {generateId} from "./utils";
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

    const exportUrl = options.beaconUrl;

    const cookieName = "_splunk_rum_sid";

    if (!document.cookie.includes(cookieName)) {
      var sessionId = generateId(128);
      document.cookie = cookieName + '=' + sessionId + "; path=/";
    }
    var rumSessionId = function () {
      var decodedCookie = decodeURIComponent(document.cookie);
      var cookies = decodedCookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(cookieName + '=') === 0) {
          return c.substring((cookieName + '=').length, c.length);
        }
      }
      return undefined;
    }();

    const whitelistEventTypes = {
      click: true,
      dblclick: true,
      submit: true,
      reset: true,
      dragend: true,
      drop: true,
      ended: true,
      pause: true,
      play: true,
      change: true,
      mousedown: true,
      mouseup: true,
    };

    class PatchedUIP extends UserInteractionPlugin {
      getZoneWithPrototype() {
        // FIXME work out ngZone issues with Angular  PENDING
        return undefined;
      }

      _allowEventType(eventType) {
        return whitelistEventTypes[eventType];
      }

      // FIXME find cleaner way to patch
      _patchHistoryMethod() {
        return (original) => {
          return function patchHistoryMethod(...args) {
            const oldHref = location.href;
            const result = original.apply(this, args);
            const newHref = location.href;
            if (oldHref !== newHref) {
              // FIXME names of attributes/span/component
              const tracer = window.SplunkRum._provider.getTracer('route');
              const span = tracer.startSpan('route change');
              span.setAttribute('prev.href', oldHref)
              // location.href set with new value by default
              span.end(span.startTime);
            }
            return result;
          };
        };
      }
      // suppress behavior of renaming spans as 'Navigation {new href}'
      // eslint-disable-next-line no-unused-vars
      _updateInteractionName(url) {
        // deliberate nop
      }
    }
    const uip = new PatchedUIP();

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
    // FIXME circleci build still broken


    const provider = new PatchedWTP({
      plugins: [
        new SplunkDocumentLoad(),
        new SplunkXhrPlugin(),
        new SplunkFetchPlugin(),
        uip,
      ],
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(new PatchedZipkinExporter(exportUrl)));
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
