# Context propagation

Splunk RUM browser agent doesn't register any context propagators as capturing `traceparent` from `server-timing` headers is done by extending existing OpenTelemetry instrumentations. However, you can register a context propagators by using OpenTelemetry API:

```html
import {propagation} from '@opentelemetry/api';
import {B3Propagator} from '@opentelemetry/propagator-b3';

propagation.setGlobalPropagator(new B3Propagator());
```
Notice that when using OpenTelemetry API directly make sure the API version you're using matches the one used by [Splunk RUM Agent](https://github.com/signalfx/splunk-otel-js-web#open-telemetry-version).
