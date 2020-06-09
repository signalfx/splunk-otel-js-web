import {ConsoleSpanExporter, SimpleSpanProcessor} from '@opentelemetry/tracing';
import {WebTracerProvider} from '@opentelemetry/web';
import {DocumentLoad} from '@opentelemetry/plugin-document-load';
import {XMLHttpRequestPlugin} from '@opentelemetry/plugin-xml-http-request';
import {UserInteractionPlugin} from '@opentelemetry/plugin-user-interaction';
import {PatchedZipkinExporter} from './zipkin';

console.log('hi');
if (!window.SfxRum) {
  window.SfxRum = {
    inited: false
  };
  // FIXME learn how to produce docs for 'exported' items (init and its options)
  // options.beaconUrl (example format: 'http://127.0.0.1:9080/api/v2/spans'
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

    const provider = new WebTracerProvider({
      plugins: [
        new DocumentLoad(),
        new XMLHttpRequestPlugin(),
        new PatchedUIP(),
      ],
      defaultAttributes: {
        'sfx.rumSessionId': rumSessionId
      }
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.addSpanProcessor(new SimpleSpanProcessor(new PatchedZipkinExporter(exportUrl)));
    provider.register();
    this.inited = true;
    console.log('SfxRum.init() complete');

  };
}
