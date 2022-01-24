> The official Splunk documentation for this page is [Manually instrument browser-based web applications](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.manual.instrumentation&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING.md#documentation).

# Identifying Users

RUM does not do anything automatically to link traces to the user visiting the site. However it can be useful to use user information to filter or debug traces. This information can be added using global attributes - attributes that get attached to every span.

[OpenTelemetry Specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/span-general.md#general-identity-attributes) provides some common attributes for identifying attributes. For RUM use we recommend: 

| Attribute | Description | Examples |
|---|---|---|
| `enduser.id` | Username, id, or some other unique identifier for the user | `'johnsmith'`, `1` |
| `enduser.role` | User's role | `'admin'`, `'writer'` |

Additional useful data can always be provided with custom global attributes.

## Example using configuration

This is useful if you already have this information when the agent is being initialised - for example added by the server rendering the page.

```html
<script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js" crossorigin="anonymous"></script>
<script>
  SplunkRum.init({
    beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
    rumAuth: 'RUM access token',
    app: 'enter-your-application-name',
    globalAttributes: {
      'enduser.id': 42,
      'enduser.role': 'admin',
    },
  });
</script>
```

## Providing it after initialisation using API

This is preferred if you initialise the agent before knowing which user is using the site, for example a statically served SPA which does a fetch call to find out currently logged in user. Note that spans generated before calling it will not have this information.

```js
import SplunkRum from '@splunk/otel-js-browser';

const user = await (await fetch('/api/user')).json();

SplunkRum.setGlobalAttributes({
  'enduser.id': user ? user.id : undefined,
  'enduser.role': user ? user.role : undefined,
});
```
