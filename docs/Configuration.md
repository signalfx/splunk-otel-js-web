> The official Splunk documentation for this page is [Configure the Splunk Browser RUM instrumentation](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.configuration&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING#documentation.md).

# Configuration

This chapter describes the configuration parameters for the Splunk Browser Agents. Adjusting the parameter defaults along with an example how to do so is also included.
## General configuration options
Below are the different initialization options available for the Agent:

|Option|Type|Default value|Description|
|---|---|---|---|
|`beaconUrl`|`string [required]`|Provided by installation wizard|Sets the destination URL to which captured telemetry is sent to be ingested. Notice that the URL is specific to the actual realm you are using (i.e. us0, us1).|
|`rumAuth`|`string [required]`|Provided by installation wizard|Defines a token authorizing the Agent to send the telemetry to the backend. You can find (or generate) the token [here](https://app.signalfx.com/o11y/#/organization/current?selectedKeyValue=sf_section:accesstokens). Notice that RUM and APM auth tokens are different.|
|`app`|`string`|`"unknown-browser-app"`|Application name, used to distinguish the telemetry from different applications.|
|`environment`|`string`|`(none)`|Sets environment for all the spans, used to distinguish between different environments such as `dev`,  `test` or `prod`. |
|`globalAttributes`|`object`|`{} empty object`|Sets additional attributes added to all spans (such as version, user id, ...)|
|`allowInsecureBeacon`|`boolean`|`false`|Allows sending data to insecure endpoints not using `https`. It is not recommended to enable this. |
|`debug`|`boolean`|`false`|Enables debug logging in developer console|
|`ignoreUrls`|`(string\|regex)[]`|`[]`|Sets a list of URLs to be ignored. Any URLs that XHR/Fetch or websocket connect that match the rules will not produce a span. Two different rules can be provided: equals match to a specified string or a regex match.|
|`cookieDomain`|`string`|`(none)`|Configures the domain used for [session tracking](Cookies.md). For example, if you have sites `foo.example.com` and `bar.example.com`, setting `cookieDomain` to `example.com` allows both sites to use the same session identifier.|
|`context.async`|`boolean`|`false`|Enables [asyncronous context manager](Async-Traces.md)|
|`exporter.onAttributesSerializing`|`(a: SpanAttributes, s?: Span) => SpanAttributes`|`(attrs) => attrs`|Provides a callback for modifying span attributes before exporting. An example use case of the serializer is to filter out PII.|
|`instrumentations`|`object`|See the following chapter|Enables or disables specific instrumentations. More details how to enable or disable the instrumentations in the next chapter.|
|`tracer`|`object`|[`TracerConfig`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/types.ts)|Configuration options passed to WebTracerProvider. Can be used [to configure sampling](./Sampling.md)|

## Configuring instrumentations
In order to enable or disable specific instrumentations in the Browser Agent, you need to change the `capture` configuration parameter. This parameter accepts an object  enabling or disabling specific instrumentations. In addition the `capture` can be used to configure instrumentations. The object structure is simple, consisting of:

- `false` - disables specific instrumentation;
- `true` - enables specific instrumentation with default options;
- `object` - passes additional options to a specific instrumentation.

|Option|Default value|Description|
|---|---|---|
|`instrumentations.connectivity`|`false`|Enables capturing [connectivity events](Instrumentations.md#instrumentation-connectivity).|
|`instrumentations.document`|`true`|Enables capturing spans related to [document loading](Instrumentations.md#instrumentation-document-load).|
|`instrumentations.errors`|`true`|Enables capturing [Javascript errors](Errors.md).|
|`instrumentations.fetch`|`true`|Enables capturing [fetch requests](Instrumentations.md#instrumentation-xhrfetch) requests.|
|`instrumentations.interactions`|`true`|Enables capturing [user interactions](Instrumentations.md#instrumentation-user-interactions) (such as clicks or keyboard events).|
|`instrumentations.longtask`|`true`|Enables capturing [long tasks](Instrumentations.md#instrumentation-long-tasks).|
|`instrumentations.postload`|`true`|Enables capturing [resources loaded after load event](Instrumentations.md#instrumentation-post-document-load).|
|`instrumentations.visibility`|`false`|Enables capturing [visibility events](Instrumentations.md#instrumentation-visibility).|
|`instrumentations.websockets`|`false`|Enables capturing [websockets](Instrumentations.md#instrumentation-websockets).|
|`instrumentations.webvitals`|`true`|Enables capturing [Web Vitals](Instrumentations.md#instrumentation-web-vitals) metrics.|
|`instrumentations.xhr`|`true`|Enables capturing [XHR requests](Instrumentations.md#instrumentation-xhrfetch) requests.|

Some instrumentations, such as interactions module, have additional configuration options which can used to override the default settings:

|Option|Type|Default value|Description|
|---|---|---|---|
|`instrumentations.interactions.events`|`{[DOM Event Name]: boolean}`|<pre>{<br>click: true,<br>dblclick: true,<br>mousedown: true,<br>mouseup: true,<br><br>submit: true,<br>reset: true,<br>change: true,<br><br>dragend: true,<br>drop: true,<br><br>ended: true,<br>pause: true,<br>play: true,<br>}<br></pre>|[DOM events](https://developer.mozilla.org/en-US/docs/Web/Events#event_listing) that are captured as user interactions, as captured from `SplunkRum.DEFAULT_AUTO_INSTRUMENTED_EVENTS`|

## Changing the configuration: examples
In situation, where you need to change the default configuration, you need to change the object passed to `SplunkRum.init()` call:

```html
<script src="/location/to/splunk-otel-web.js"></script>
<script>
  window.SplunkRum.init(
    {
      beaconUrl: 'https://rum-ingest.us0.signalfx.com/v1/rum'
      rumAuth: 'ABC123...789',
      app: 'my-awesome-app',
      // Any additional options
    });
</script>
```

The following example changes three default configuration parameters:

- enables listening of `gamepadconneted` events to the list of events captured by default;
- disables monitoring for `longtasks`;.
- enables `websockets`.

```js
SplunkRum.init({
  beaconUrl: 'https://rum-ingest.us0.signalfx.com/v1/rum',
  rumAuth: 'ABC123...789',
  app: 'my-awesome-app',
  instrumentations: {
    interactions: {
      events: {
        gamepadconnected: true,
      },
    },
    longtask: false,
    websockets: true,
  },
});
```
