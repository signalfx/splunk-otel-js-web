# Sampling

Splunk RUM captures all of the data from all of the users by default. This behavior can be configured by passing a [Sampler](https://github.com/open-telemetry/opentelemetry-js-api/blob/main/src/trace/Sampler.ts) to the tracer.

Splunk's distribution of OpenTelemetry Javascript includes following samplers for convenience:

* [AlwaysOffSampler from `@opentelemetry/core`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/src/trace/sampler/AlwaysOffSampler.ts)
* [AlwaysOnSampler from `@opentelemetry/core`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/src/trace/sampler/AlwaysOnSampler.ts)
* [ParentBasedSampler from `@opentelemetry/core`](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/src/trace/sampler/ParentBasedSampler.ts)

These are added to `SplunkRum.*` allowing use on CDN distribution. For example to only get traces from logged in users:

```html
<!-- When using from CDN -->
<script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js" crossorigin="anonymous"></script>
<script>
  var shouldTrace = isUserLoggedIn();

  SplunkRum.init({
    beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
    rumAuth: '<RUM access token>',
    app: '<application-name>',
    tracer: {
      sampler: shouldTrace ? new SplunkRum.AlwaysOnSampler() : new SplunkRum.AlwaysOffSampler(),
    },
  });
</script>
```

```js
// When using NPM you can get samplers directly from @opentelemetry/core
import {AlwaysOnSampler, AlwaysOffSampler} from '@opentelemetry/core';
import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
  beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
  rumAuth: '<RUM access token>',
  app: '<application-name>',
  tracer: {
    sampler: userShouldBeTraced() ? new SplunkRum.AlwaysOnSampler() : new SplunkRum.AlwaysOffSampler(),
  },
});
```

## Session Based Sampler

Splunk's Distribution of OpenTelemetry also includes a custom sampler that is integrated with our sessions support. This should be preferred over trace ratio based sampler as it would lead to partially reported data from all of the sessions, causing more confusion over randomly missing spans.

Session based sampler can be accessed from `SplunkRum.SessionBasedSampler` in CDN build and from `SessionBasedSampler` export when using Splunk RUM via NPM. It accepts a configuration object:

|Option|Type|Default value|Description|
|---|---|---|---|
|`ratio`|`number`|`1.0`|Determines the percentage of sessions reported (from 0.0 = no sessions to 1.0 = all sessions)|
|`sampled`|`Sampler`|`AlwaysOnSampler`|Sampler used when session should be sampled|
|`notSampled`|`Sampler`|`AlwaysOffSampler`|Sampler used when session should not be sampled|

To capture data from half of the sessions:

```html
<!-- When using from CDN -->
<script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js" crossorigin="anonymous"></script>
<script>
  SplunkRum.init({
    beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
    rumAuth: '<RUM access token>',
    app: '<application-name>',
    tracer: {
      sampler: new SplunkRum.SessionBasedSampler({
        ratio: 0.5
      }),
    },
  });
</script>
```

```js
// When using via NPM it is exported from the package
import SplunkOtelWeb, {SessionBasedSampler} from '@splunk/otel-web';

SplunkOtelWeb.init({
  beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
  rumAuth: '<RUM access token>',
  app: '<application-name>',
  tracer: {
    sampler: new SessionBasedSampler({
      ratio: 0.5
    }),
  },
});
```
