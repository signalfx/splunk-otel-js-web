# Manual instrumentation using API

In case when auto-instrumentations do not capture all the information needed, you can capture additional telemetry by manually instrumenting your application (for example, to report timings for keyboard events), you can use the [OpenTelemetry API](https://github.com/open-telemetry/opentelemetry-js/tree/master/packages/opentelemetry-tracing). The `TracingProvider` used by Splunk Browser Agent in `SplunkRum.provider`.

|Example|Instrumentation code|
|---|---|
|Manually creating a span:|<pre>const provider = SplunkRum.provider;<br>const span = provider.getTracer('searchbox').startSpan('search');<br>span.setAttribute('searchLength', searchString.length);<br>// time passes<br>span.end();</pre>|
|Set `userId` on all the spans:|<pre>SplunkRum.setGlobalAttributes({<br>  'user': 'Test User'<br>});</pre>|

If you have some existing manual instrumentation of your app with, e.g., another vendor's API, you can usually translate this code fairly easily to use OpenTelemetry conventions. We have provided [a migration guide](https://github.com/signalfx/splunk-otel-js-web/blob/main/docs/MigratingInstrumentation.md) covering this in more in depth.
