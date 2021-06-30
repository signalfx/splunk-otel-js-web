# Context propagation

Splunk RUM browser agent uses and registers `HttpBaggagePropagator` by default. Note that capturing `traceparent` from `server-timing` headers is done by extending existing OpenTelemetry instrumentations. If you'd like to register additional propagators, then you need to include `HttpBaggagePropagator`:

```html
import {propagation} from '@opentelemetry/api';
import {B3Propagator} from '@opentelemetry/propagator-b3';
import {HttpBaggagePropagator} from "@opentelemetry/core";

api.propagation.setGlobalPropagator(
  new CompositePropagator({
    propagators: [
      new B3Propagator(),
      new HttpBaggagePropagator(),
    ],
  })
);
```

When using OpenTelemetry API directly, make sure the API version you're using matches the one used by [Splunk RUM Agent](https://github.com/signalfx/splunk-otel-js-web#open-telemetry-version).
