<p align="center">
  <a href="https://github.com/signalfx/splunk-otel-js-web/releases">
    <img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/signalfx/splunk-otel-js-web?include_prereleases&style=for-the-badge">
  </a>
  <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/signalfx/splunk-otel-js-web/Continuous%20Integration%20Main/main?style=for-the-badge">
  <img alt="Beta" src="https://img.shields.io/badge/status-beta-informational?style=for-the-badge">
</p>

# Splunk Session Recorder

Splunk session recorder combines [rr-web](https://github.com/rrweb-io/rrweb) with [OpenTelemetry JavaScript for
Web](https://github.com/open-telemetry/opentelemetry-js)

> :construction: This project is currently in **BETA**. It is **officially supported** by Splunk. However, breaking changes **MAY** be introduced.

## Installation

### Via NPM package manager

Splunk session recorder can be installed via the `@splunk/otel-web-session-recorder` npm package:

```
npm install @splunk/otel-web-session-recorder
```

Then start the recording by importing the package and calling `SplunkSessionRecorder.init`:

```js
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

// This must be called after initializing splunk rum
SplunkSessionRecorder.init({
  beaconEndpoint: 'https://rum-ingest.<realm>.signalfx.com/v1/rumreplay',
  rumAccessToken: '<auth token>'
});
```
