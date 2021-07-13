# Manual instrumentation using API

In case when auto-instrumentations do not capture all the information needed, you can capture additional telemetry by manually instrumenting your application (for example, to report timings for actions that take multiple requests), you can use the [OpenTelemetry API](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-tracing). Splunk Browser Agent automatically registers it's TraceProvider with `@opentelemetry/api`, allowing you or any other instrumentations you want to use to access it via standard methods.

> The version of `@opentelemetry/api` should match [the agent's used `@opentelemetry/api` version](https://github.com/signalfx/splunk-otel-js-web#open-telemetry-version) <!-- TODO when stable it may be of same major and up to same minor version -->

|Example|Instrumentation code|
|---|---|
|Manually creating a span:|<pre>import {trace} from '@opentelemetry/api'<br><br>const span = trace.getTracer('searchbox').startSpan('search');<br>span.setAttribute('searchLength', searchString.length);<br>// time passes<br>span.end();</pre>|
|Set `userId` on all the spans ([See: Identifying Users](IdentifyingUsers.md)):|<pre>SplunkRum.setGlobalAttributes({<br>  'enduser.id': 'Test User'<br>});</pre>|
|Create a custom event|<pre>import {trace} from '@opentelemetry/api'<br><br>const tracer = trace.getTracer('appModuleLoader');<br>const span = tracer.startSpan('test.module.load', {<br>  attributes: {<br>    <em>'workflow.name'</em>: 'test.module.load'<br>  }<br>});<br><br>// time passes<br>span.end();</pre>|

If you have some existing manual instrumentation of your app with, e.g., another vendor's API, you can usually translate this code fairly easily to use OpenTelemetry conventions. We have provided [a migration guide](https://github.com/signalfx/splunk-otel-js-web/blob/main/docs/MigratingInstrumentation.md) covering this in more in depth.
