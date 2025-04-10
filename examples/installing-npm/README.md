# Installing via NPM

## Checking out this example
Run `npm install` to install required dependencies.

Run `npm start` to start the example app (requires another shell tab/instance).

Open <http://localhost:9100/> to open the app and start producing telemetry data.

## Sending the data to Splunk Real User Monitoring <a name="backend-config"></a>
Add `rumAccessToken` and change `beaconEndpoint` in the instrumentation initialisation object:
```js
SplunkOtelWeb.init({
  ...
  beaconEndpoint: 'https://rum-ingest.us0.signalfx.com/api/v2/spans',
  rumAccessToken: 'xxx', // TODO: describe how to get the token
  ...
});
```

Navigate to <https://app.signalfx.com/o11y/> to see your data.

## Installing via NPM in your own app

```bash
npm install @splunk/otel-web
```
Note: in modern versions of NPM, installed packages are added to `package.json` by default.

Add a file, which will initialise instrumentation (in our case `./src/instrumentation.ts`):
```js
import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
  // we will provision a temporary local backend for testing in a few steps
  beaconEndpoint: 'http://localhost:9411/api/v2/spans',
  allowInsecureBeacon: true,
  applicationName: 'splunk-otel-web-example-npm',
});
```

Import the newly created file in your root `.ts` file (in our case it's `./src/index.ts`) **above other imports**:
```js
import './instrumentation.ts';
/* other imports */
```

Start your application, and it will begin sending telemetry data, which you can observe in either DevTools console,
or in DevTools Network tab.
