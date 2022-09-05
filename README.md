<p align="center">
  <strong>
    <a href="https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current">Getting Started</a>
    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
    <a href="./CONTRIBUTING.md">Getting Involved</a>
  </strong>
</p>

<p align="center">
  <a href="https://github.com/signalfx/splunk-otel-js-web/releases">
    <img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/signalfx/splunk-otel-js-web?include_prereleases&style=for-the-badge">
  </a>
  <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/signalfx/splunk-otel-js-web/Continuous%20Integration%20Main/main?style=for-the-badge">
  <img alt="Beta" src="https://img.shields.io/badge/status-beta-informational?style=for-the-badge">
</p>

# Splunk distribution of OpenTelemetry JavaScript for Web

The Splunk distribution of [OpenTelemetry JavaScript for
Web](https://github.com/open-telemetry/opentelemetry-js)

> :construction: This project is currently in **BETA**. It is **officially supported** by Splunk. However, breaking changes **MAY** be introduced.

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

The official Splunk documentation for this page is [Instrument browser-based web applications for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.browser.rum&version=current).

## Open Telemetry version

Compatibility between the versions of this project and Open Telemetry is specified in [CHANGELOG.md](./CHANGELOG.md).

## Building and contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for instructions on building, running tests, and so forth.

## License

The Splunk distribution of OpenTelemetry JavaScript Browser is a distribution
of the [OpenTelemetry JavaScript
Browser](https://github.com/open-telemetry/opentelemetry-js) project. It is
released under the terms of the Apache Software License version 2.0. See [the
license file](./LICENSE) for more details.

>ℹ️&nbsp;&nbsp;SignalFx was acquired by Splunk in October 2019. See [Splunk SignalFx](https://www.splunk.com/en_us/investor-relations/acquisitions/signalfx.html) for more information.
