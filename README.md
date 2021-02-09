# Splunk distribution of OpenTelemetry JavaScript Browser

The Splunk distribution of [OpenTelemetry JavaScript
Browser](https://github.com/open-telemetry/opentelemetry-js)
provides a JavaScript file that can be added into a page
that automatically captures:

- Document load information, including resource fetching
- User interactions (clicks)
- XmlHttpRequest (XHR) and fetch calls, including the full URL but not
  including any body/payload
- WebSocket activity
- Errors

By default, the following error sources are captured:

- `addEventListener('error')` which reports unhandled errors (e.g., from
  setInterval callbacks)
- `addEventListener('unhandledrejection')` which reports unhandled Promise
  rejections
- instrumenting usage of `console.error`
- `document.documentElement.addEventListener('error', ... {capture:true});`
  which reports errors on DOM elements (e.g., image loading issue)

All data and errors captured are reported to Splunk RUM.

> :construction: This project is currently in **BETA**.

## Getting Started

To get started, download the JS file from the latest release and add its path
to your page.

For example:

```html
<script src="http://your-site.com/path/to/splunk-rum.js"></script>
<script>
  SplunkRum.init(
    {
      // Your beaconUrl should be provided by your friendly Splunk representative
      beaconUrl: 'https://example.com/v1/rum',
      // You can generate or get your rumAuth token from your friendly Splunk representative
      rumAuth: 'ABC123...789',
      app: 'my-awesome-app'
    });
</script>
```

## Installation options

Please read [INSTALLING.md](./docs/INSTALLING.md) for more advanced installation scenarios.

## All configuration options

### `SplunkRum.init({ })`

| Option | Type | Notes | Required? | Default |
|--------|------|-------|-----------|---------|
| beaconUrl | string | Destination for the captured data | Yes | (No default) |
| rumAuth | string | Publicly-visible `rumAuth` value.  Please do not paste any other access token or auth value into here, as this will be visible to every user of your app | Yes | (No default) |
| app | string | Application name | No | 'unknown-browser-app' |
| environment | string | Sets a value for the `environment` attribute (persists through calls to `setGlobalAttributes()`) | No | (No default) |
| globalAttributes | object | Extra attributes to add to each reported span.  See also `setGlobalAttributes` | No | {} |
| captureErrors | boolean | Turns on/off error reporting feature | No | true |
| allowInsecureBeacon | boolean | Allows http beacon urls | No | false |
| debug | boolean | Turns on/off internal debug logging | No | false |
| ignoreUrls | array | Applies for XHR,Fetch and Websocket URLs. URLs that partially match any regex in ignoreUrls will not be traced. In addition, URLs that are _exact matches_ of strings in ignoreUrls will also not be traced. | No | [] |
| spanProcessor | SpanProcessor | Offers ability to alter/remove data in-browser.  See below for more details | No | (undefined) |
| adjustAutoInstrumentedEvents | { [DOM Event Name]?: boolean } | Set keys to `false` to disable events handled by default. Set additional keys to true to auto-instrument `addEventListener` handlers. | No | Please check `window.SplunkRum.DEFAULT_AUTO_INSTRUMENTED_EVENTS` |

### `SplunkRum.setGlobalAttributes(attributes)`

You can (re)set the entirety of `globalAttributes` at any time with this
method.  Any spans reported from this point on will have your new attributes
set.  You can pass `{}` or `undefined` to clear your global attributes.

## Manual OpenTelemetry instrumentation

### Tracing Provider

If you would like to manually instrument your application (for example, to
report timings for key events), you can use the
[OpenTelemetry](https://github.com/open-telemetry/opentelemetry-js/tree/master/packages/opentelemetry-tracing)
API.  Our `TracingProvider` is in `SplunkRum.provider`.

Example on how to manually instrument:

```javascript
  const provider = SplunkRum.provider;
  const span = provider.getTracer('searchbox').startSpan('search');
  span.setAttribute('searchLength', searchString.length);
  // time passes
  span.end();
```

### Errors

While many errors are captured by default, manual errors can be reported by
using:

```javascript
  SplunkRum.error(errorObjectOrMessageString);
```

### spanProcessor

Passing an OpenTelemetry `SpanProcessor` as a `spanProcessor:` option to `init()` adds the provided
processor to our tracing provider.  This processor can modify/create/remove attributes of
spans before they leave the browser.  A trivial example of this might be:

```javascript
class MySpanProcessor {
  onEnd(span) {
    if (span.attributes['http.url']) {
      span.attributes['http.url'] = '(redacted)';
    }
  }
  onStart(span, cts) { }
  forceFlush() { return Promise.resolve(); }
  shutdown() { return Promise.resolve(); }
};
SplunkRum.init({
  ...
  spanProcessor: new UrlRedactor(),
});
```

## Supported browsers

Not all supported browsers support all features/attributes, but the following browsers are generally supported.  We are actively working on expanding this list.

- Chrome 52+
- Safari 11+
- Firefox 57+
- Edge 79+
- IE not currently supported

### Known issues

Auto-instrumentation doesn't currently capture events handled on `document` level, ie. `document.addEventListener(...)`.

Web Workers and Service Workers are not supported. Code loaded within them will not be auto-instrumented, and currently there is no version of the code which can be used within either Web or Service Workers for manual instrumentation.

## Building and contributing

Please read [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for instructions on building, running tests, and so forth.

## License and versioning

The Splunk distribution of OpenTelemetry JavaScript Browser is a distribution
of the [OpenTelemetry JavaScript
Browser](https://github.com/open-telemetry/opentelemetry-js) project. It is
released under the terms of the Apache Software License version 2.0. See [the
license file](./LICENSE) for more details.
