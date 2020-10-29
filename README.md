## Installing into your app
You'll need to either build the final splunk-rum.js file or obtain it from a release.
To build from scratch, please see the notes in CONTRIBUTING.md.

Place it in your page as
```html
<script src="http://something-not-yet-known.domain/path/to/splunk-rum.js"></script>
<script>
  window.SplunkRum && window.SplunkRum.init(
    {
      // Your beaconUrl should be provided by your friendly Splunk representative
      beaconUrl: 'http://example.com/v1/rum',
      // You can generate or get your rumAuth token from your friendly Splunk representative
      rumAuth: 'ABC123...789',
      app: 'my-awesome-app'
    });
</script>
```

## `SplunkRum.init({ })` options
| Option | Type | Notes | Required? | Default |
|--------|------|-------|-----------|---------|
| beaconUrl | string | Destination for the captured data | Yes | (No default) |
| rumAuth | string | Publicly-visible `rumAuth` value.  Please do not paste any other access token or auth value into here, as this will be visible to every user of your app | Temporarily no | (No default) |
| app | string | Application name | No | 'unknown-browser-app' |
| globalAttributes | object | Extra attributes to add to each reported span.  See also `setGlobalAttributes` | No | {} |
| captureErrors | boolean | Turns on/off error reporting feature | No | true |
| allowInsecureBeacon | boolean | Allows http beacon urls | No | false |
| debug | boolean | Turns on/off internal debug logging | No | false |

## SplunkRum.setGlobalAttributes(attributes)
You can (re)set the entirety of `globalAttributes` at any time with this method.  Any spans reported from
this point on will have your new attributes set.  You can pass `{}` or `undefined` to clear your global attributes.

## Features / data captured

- Document load information, including resource fetching
- User interactions (clicks)
- XmlHttpRequest (XHR) and fetch calls, including the full URL but not including any body/payload
- WebSocket activity
- Errors (see below for more details)

## Errors

By default, we capture from the following sources of errors:

- `addEventListener('error')` which reports unhandled errors (e.g., from setInterval callbacks)
- `addEventListener('unhandledrejection')` which reports unhandled Promise rejections
- instrumenting usage of `console.error`
- `document.documentElement.addEventListener('error', ... {capture:true});` which reports errors on DOM elements (e.g., image loading issue)

If you would like to report an error manually, you can use:
```javascript
  window.SplunkRum && window.SplunkRum.error(errorObjectOrMessageString);
```

## Manual OpenTelemetry instrumentation

If you would like to manually instrument your application (for example, to report timings for key events),
 you can use the [OpenTelemetry](https://github.com/open-telemetry/opentelemetry-js/tree/master/packages/opentelemetry-tracing) 
API.  Our `TracingProvider` is in `SplunkRum.provider`.  Here is an example of how to use it:
```javascript
  const provider = window.SplunkRum.provider;
  const span = provider.getTracer('searchbox').startSpan('search');
  span.setAttribute('searchLength', searchString.length);
  // time passes
  span.end();
```
