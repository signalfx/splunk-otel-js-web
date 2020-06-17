import {ConsoleSpanExporter, SimpleSpanProcessor, Tracer} from '@opentelemetry/tracing';
import {WebTracerProvider} from '@opentelemetry/web';
import {DocumentLoad} from '@opentelemetry/plugin-document-load';
import {XMLHttpRequestPlugin} from '@opentelemetry/plugin-xml-http-request';
import {UserInteractionPlugin} from '@opentelemetry/plugin-user-interaction';
import {PatchedZipkinExporter} from './zipkin';
import {captureTraceParent} from './servertiming';

console.log('hi');
if (!window.SfxRum) {
  window.SfxRum = {
    inited: false
  };
  // FIXME learn how to produce docs for 'exported' items (init and its options)
  // options.beaconUrl (example format: 'http://127.0.0.1:9080/api/v2/spans'
  // options.app
  window.SfxRum.init = function (options) {
    if (this.inited) {
      console.log("already init()ed.");
      return;
    }
    if (!options.beaconUrl) {
      // FIXME error handling
      console.log("init( {beaconUrl: 'https://something'} ) is required.");
      return;
    }
    const app = options.app || 'unknown-browser-app';
    console.log('SfxRum.init() starting');

    const exportUrl = options.beaconUrl;

    const cookieName = "_sfx_rum_sid";

    if (!document.cookie.includes(cookieName)) {
      var id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function (c) {
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
    }
    // FIXME this is still not the cleanest way to add an attribute to all created spans..,
    class PatchedWTP extends WebTracerProvider {
      constructor(config) {
        super(config);
      }
      getTracer(name, version, config) {
        const tracer = super.getTracer(name, version, config);
        const origStartSpan = tracer.startSpan;
        tracer.startSpan = function() {
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
    xhrplugin._createSpan = function() {
      const xhr = arguments[0];
      const span = origCreateSpan.apply(xhrplugin, arguments);
      // don't care about success/failure, just want to see response headers if they exist
      xhr.addEventListener('loadend', function() {
        const st = xhr.getResponseHeader('server-timing');
        if (st) {
          captureTraceParent(st, span);
        }
      });
      return span;
    }


    const provider = new PatchedWTP({
      plugins: [
        new DocumentLoad(),
        xhrplugin,
        new PatchedUIP(),
      ],
      defaultAttributes: {
        'sfx.rumSessionId': rumSessionId,
        'app': app
      }
    });


    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.addSpanProcessor(new SimpleSpanProcessor(new PatchedZipkinExporter(exportUrl)));
    provider.register();
    this.inited = true;
    console.log('SfxRum.init() complete');

  };
}
