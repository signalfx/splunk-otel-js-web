import {ConsoleSpanExporter, SimpleSpanProcessor} from '@opentelemetry/tracing';
import {WebTracerProvider} from '@opentelemetry/web';
import {DocumentLoad} from '@opentelemetry/plugin-document-load';
import {XMLHttpRequestPlugin} from '@opentelemetry/plugin-xml-http-request';
import {UserInteractionPlugin} from '@opentelemetry/plugin-user-interaction';
import {FetchPlugin} from "@opentelemetry/plugin-fetch";
import {PatchedZipkinExporter} from './zipkin';
import {captureTraceParent, captureTraceParentFromPerformanceEntries} from './servertiming';
import {captureErrors} from "./errors";

// FIXME caps on things - in particular on sendBeacon frequency and size.
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
      console.log("init( {beaconUrl: 'https://something'} ) is required.");
      return;
    }
    const app = options.app || 'unknown-browser-app';
    console.log('SplunkRum.init() starting');

    const instanceId = "xxxxxxxxxxxxxxxx".replace(/x/g, function () {
      return ((Math.random() * 16) | 0).toString(16);
    });

    const exportUrl = options.beaconUrl;

    const cookieName = "_splunk_rum_sid";

    if (!document.cookie.includes(cookieName)) {
      var id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function () {
        return ((Math.random() * 16) | 0).toString(16);
      });
      document.cookie = cookieName + '=' + id + "; path=/";
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

    class PatchedUIP extends UserInteractionPlugin {
      getZoneWithPrototype() {
        // FIXME work out ngZone issues with Angular
        return undefined;
      }

      // FIXME copy+paste job here
      _patchHistoryMethod() {
        return (original) => {
          return function patchHistoryMethod(...args) {
            const oldHref = location.href;
            const result = original.apply(this, args);
            const newHref = location.href;
            if (oldHref !== newHref) {
              // FIXME sequencing of access to tracer
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
    }

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
    // FIXME more ugly copy+paste to patch in functionality.  In this case limiting the
    // types of events we care to listen to (too many mousemove events => too many spans)
    const uip = new PatchedUIP();
    uip._patchElement = function () {
      const plugin = this;
      return (original) => {
        return function addEventListenerPatched(type, listener, useCapture) {
          const patchedListener = (...args) => {
            const target = this;
            if (whitelistEventTypes[type]) {
              const span = plugin._createSpan(target, type);
              if (span) {
                return plugin._tracer.withSpan(span, () => {
                  const result = listener.apply(target, args);
                  // no zone so end span immediately
                  span.end();
                  return result;
                });
              } else {
                return listener.apply(target, args);
              }
            } else {
              return listener.apply(target, args);
            }
          };
          return original.call(this, type, patchedListener, useCapture);
        };
      };
    }


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
          return span;
        }
        return tracer;
      }
    }

    const xhrplugin = new XMLHttpRequestPlugin();

    // FIXME another thing to figure out how to patch more cleanly
    // FIXME also start augmenting test suites for this stuff
    const origCreateSpan = xhrplugin._createSpan;
    xhrplugin._createSpan = function () {
      const xhr = arguments[0];
      const span = origCreateSpan.apply(xhrplugin, arguments);
      // don't care about success/failure, just want to see response headers if they exist
      xhr.addEventListener('readystatechange', function () {
        if (xhr.readyState == xhr.HEADERS_RECEIVED && xhr.getAllResponseHeaders().includes('server-timing')) {
          const st = xhr.getResponseHeader('server-timing');
          if (st) {
            captureTraceParent(st, span);
          }
        }
      });
      return span;
    }

    // And now for patching in docload to look for Server-Timing
    const docLoad = new DocumentLoad();
    const origEndSpan = docLoad._endSpan;
    docLoad._endSpan = function (span, performanceName, entries) {
      if (span && span.name !== 'documentLoad') { // only apply link to document fetch
        captureTraceParentFromPerformanceEntries(entries, span);
      }
      return origEndSpan.apply(docLoad, arguments);
    };
    // To maintain compatibility, getEntries copies out select items from
    // different versions of the performance API into its own structure for the
    // intitial document load (but leaves the entries undisturbed for resource loads).
    const origGetEntries = docLoad._getEntries;
    docLoad._getEntries = function () {
      const answer = origGetEntries.apply(docLoad, arguments);
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries && navEntries[0] && navEntries[0].serverTiming) {
        answer.serverTiming = navEntries[0].serverTiming;
      }
      return answer;
    };

    // A random place to list a bunch of items that are unresolved
    // FIXME is there any way to tell that a resource load failed from its performance entry?
    // FIXME is there any way to get sizes of transfer everywhere? (xhr/fetch result, resource load, initial doc)
    // FIXME longtask
    // FIXME repo/licensing issues
    // FIXME strip http.user_agent from spans as redundant
    // FIXME rumKey

    const fetch = new FetchPlugin();
    const origAFSA = fetch._addFinalSpanAttributes;
    fetch._addFinalSpanAttributes = function () {
      if (arguments.length >= 2) {
        const span = arguments[0];
        const fetchResponse = arguments[1];
        if (span && fetchResponse && fetchResponse.headers) {
          const st = fetchResponse.headers.get('Server-Timing');
          if (st) {
            captureTraceParent(st, span);
          }
        }
      }
      origAFSA.apply(fetch, arguments);
    };

    const provider = new PatchedWTP({
      plugins: [
        docLoad,
        xhrplugin,
        fetch,
        uip,
      ],
      defaultAttributes: {
        'splunk.rumSessionId': rumSessionId,
        'app': app,
        'scriptInstance': instanceId,
      }
    });


    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.addSpanProcessor(new SimpleSpanProcessor(new PatchedZipkinExporter(exportUrl)));
    provider.register();
    Object.defineProperty(this, '_provider', {value:provider});
    if (!!options.captureErrors) {
      captureErrors(this, provider); // also registers SplunkRum.error
    } else {
      // stub out error reporting method to not break apps that call it
      this.error = function() { }
    }
    this.inited = true;
    console.log('SplunkRum.init() complete');
  };
}
