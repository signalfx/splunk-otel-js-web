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
<script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js" crossorigin="anonymous"></script>
<script>
  SplunkRum.init({
      beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
      rumAuth: '<RUM_ACCESS_TOKEN>',
      app: '<YOUR_APPLICATION_NAME>'
    });
</script>
```

Please read [INSTALLING.md](./docs/INSTALLING.md) for more advanced installation scenarios.

## Supported browsers

Not all supported browsers support all features/attributes, but the following
browsers are generally supported.  We are actively working on expanding this
list.

- Chrome 52+
- Safari 11+
- Firefox 57+
- Edge 79+
- IE not currently supported

### Known issues

Auto-instrumentation doesn't currently capture events handled on `document`
level, ie. `document.addEventListener(...)`.

Web Workers and Service Workers are not supported. Code loaded within them will
not be auto-instrumented, and currently there is no version of the code which
can be used within either Web or Service Workers for manual instrumentation.

## Open Telemetry version

| @splunk/otel-web | @opentelemetry/api |
|------------------|--------------------|
| 0.2.x | 0.18.x |
| 0.1.x | 0.15.x |

## All configuration options

### `SplunkRum.init({ })`

| Option | Type | Notes | Default |
|--------|------|-------|---------|
| beaconUrl | string (required) | Destination for the captured data | (No default) |
| rumAuth | string (required) | Publicly-visible `rumAuth` value.  Please do not paste any other access token or auth value into here, as this will be visible to every user of your app | (No default) |
| app | string | Application name | 'unknown-browser-app' |
| environment | string | Sets a value for the `environment` attribute (persists through calls to `setGlobalAttributes()`) | (No default) |
| globalAttributes | object | Extra attributes to add to each reported span.  See also `setGlobalAttributes` | {} |
| cookieDomain | string | Sets session cookie to this domain | If unspecified, it defaults to the same host that set the cookie, excluding subdomains
| allowInsecureBeacon | boolean | Allows http beacon urls | false |
| debug | boolean | Turns on/off internal debug logging | false |
| ignoreUrls | array | Applies for XHR,Fetch and Websocket URLs. URLs that partially match any regex in ignoreUrls will not be traced. In addition, URLs that are _exact matches_ of strings in ignoreUrls will also not be traced. | [] |
| spanProcessor | SpanProcessor | Offers ability to alter/remove data in-browser.  See below for more details | (undefined) |
| instrumentations | { [moduleName]?: boolean or object } | Configuration for instrumentation modules. See following section for details. |
| exporter.onAttributesSerializing | (s: Span): SpanAttributes | Described in [its own section](#redacting-pii) | (s) => s.attributes |

### Capturing modules

Capturing modules can be configured by passing following values to `instrumentations` object in config:

- `false` - disables this module
- `true` - enables this module with default options
- `object` - enables with additional options

| Option | Default | Description |
|---|---|---|
| instrumentations.document | true | Capturing spans related to document loading |
| instrumentations.errors | true | Capturing errors |
| instrumentations.interactions | true | Capturing interactions |
| instrumentations.longtask | true | Capturing long task spans |
| instrumentations.websockets | false | Capturing websockets |
| instrumentations.webvitals | true | Capturing webvitals |
| instrumentations.xhr | true | Capturing XHR and fetch requests | 

Additional configuration options are available for following modules:

### User interactions

| Option | Type | Notes | Default |
|---|---|---|---|
| instrumentations.interactions.events | { [DOM Event Name]?: boolean } | Set keys to `false` to disable events handled by default. Set additional keys to true to auto-instrument `addEventListener` handlers. | Please check `window.SplunkRum.DEFAULT_AUTO_INSTRUMENTED_EVENTS` |

### `SplunkRum.setGlobalAttributes(attributes)`

You can (re)set `globalAttributes` at any time with this
method. Using it will overwrite specified properties and leave others unchanged. 
Any spans reported from this point on will have your new attributes set.  
You can pass `{}` or `undefined` to clear your global attributes.

### Redacting PII
In certain situations, metadata collected by our instrumentation may include PII.
We'd advise that you review 2 cases in particular:
- any network operation, where a secret piece of information might be present in the URL (e.g. an authentication token)
- any user interaction (e.g. a click), where a target element might contain a secret piece of information in its `id`

To redact PII you can pass an option when initializing.
```javascript
SplunkRum.init({
  ...otherOptions,
  exporter: {
    onAttributesSerializing: (span) => ({
      ...span.attributes,
      'http.url': /secret\=/.test(span.attributes['http.url']) ? '[redacted]' : span.attributes['http.url'],
    }),
  },
});
```
Please note that this method (spread operator) carries a small risk of dropping non-enumerable properties should anyone define them on `span.attributes`.

For a working example see [this integration test](integration-tests/tests/redacting-attributes/index.ejs).

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

## Building and contributing

Please read [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for instructions on building, running tests, and so forth.

## License and versioning

The Splunk distribution of OpenTelemetry JavaScript Browser is a distribution
of the [OpenTelemetry JavaScript
Browser](https://github.com/open-telemetry/opentelemetry-js) project. It is
released under the terms of the Apache Software License version 2.0. See [the
license file](./LICENSE) for more details.
