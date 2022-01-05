> The official Splunk documentation for this page is [Configure the Splunk Browser RUM instrumentation](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.configuration&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING#documentation.md).

# Context propagation

Splunk RUM browser agent doesn't register any context propagators as capturing `traceparent` from `server-timing` headers is done by extending existing OpenTelemetry instrumentations. However, you can register a context propagators by using OpenTelemetry API:

```html
import {propagation} from '@opentelemetry/api';
import {B3Propagator} from '@opentelemetry/propagator-b3';

propagation.setGlobalPropagator(new B3Propagator());
```

Notice that when using OpenTelemetry API directly make sure the API version you're using matches the one used by [Splunk RUM Agent](https://github.com/signalfx/splunk-otel-js-web#open-telemetry-version).
