---
<p align="center">
  <strong>
    <a href="./docs/Instsallation.md">Getting Started</a>
    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
    <a href="./docs/CONTRIBUTING.md">Getting Involved</a>
  </strong>
</p>

<p align="center">
  <a href="https://github.com/signalfx/splunk-otel-java/releases">
    <img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/signalfx/splunk-otel-js-web?include_prereleases&style=for-the-badge">
  </a>
  <img alt="Beta" src="https://img.shields.io/badge/status-beta-informational?style=for-the-badge">
</p>
---

# Splunk distribution of OpenTelemetry JavaScript for Web

The Splunk distribution of [OpenTelemetry JavaScript for
Web](https://github.com/open-telemetry/opentelemetry-js)

> :construction: This project is currently in **BETA**.

## Getting Started

The easiest way to get started is to use Splunk RUM distributed via CDN

1. Include & initialize the Splunk RUM by copying the following to HEAD section for all the HTML files or templates in your application

    ```html
    <script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js" crossorigin="anonymous"></script>
    <script>
      SplunkRum.init({
          beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
          rumAuth: 'RUM access token',
          app: 'enter-your-application-name'
        });
    </script>
    ```

1. Modify the initialization parameters to specify:
   - `beaconUrl` - the destination URL to which captured telemetry is sent to be ingested. Replace the `<REALM>` with the actual realm you are using (i.e. us0, us1). 
   - `rumAuth` - token authorizing the Agent to send the telemetry to the backend. You can find (or generate) the token [here](https://app.signalfx.com/o11y/#/organization/current?selectedKeyValue=sf_section:accesstokens). 
     Notice that RUM and APM auth tokens are different.
   - `app` - naming the application that will be monitored so it can be distinguished from other applications.
1. Deploy the changes to your application and make sure that the application is being used.

The method above is the recommendation to get started with Splunk RUM. This approach picks up the latest stable version of the Browser Agent distributed via CDN and loads the agent synchronously.

If you don't yet have a backend where to send data to you can set `debug: true` and see the created spans in browser console.
Please read [Installation.md](./docs/Installation.md) for more info on different installation options.

## Documentation

- [Installation](./docs/Installation.md)
- [Configuration](./docs/Configuration.md)
- [Supported browsers](./docs/SupportedBrowsers.md)
- [Data model](./docs/DataModel.md)
- [Instrumentations](./docs/Instrumentations.md)
- [Collecting errors](./docs/Errors.md)
- [Manual instrumentation](./docs/ManualInstrumentation.md)
- [Exporters](./docs/Exporters.md)
- [Context propagation](./docs/ContextPropagation.md)
- [Data sending](./docs/DataSending.md)
- [Cookies](./docs/Cookies.md)
- [Content security policy](./docs/ContentSecurityPolicy.md)
- [Redacting PII](./docs/PII.md)

## Open Telemetry version

| @splunk/otel-web | @opentelemetry/api |
|------------------|--------------------|
| 0.4.x | 0.18.x |
| 0.3.x | 0.18.x |
| 0.2.x | 0.18.x |
| 0.1.x | 0.15.x |

## Building and contributing

Please read [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for instructions on building, running tests, and so forth.

## License and versioning

The Splunk distribution of OpenTelemetry JavaScript Browser is a distribution
of the [OpenTelemetry JavaScript
Browser](https://github.com/open-telemetry/opentelemetry-js) project. It is
released under the terms of the Apache Software License version 2.0. See [the
license file](./LICENSE) for more details.
