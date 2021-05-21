# Building, testing and contributing to splunk-browser-otel-js
## Building

```bash
npm install
npm run compile
```

## Functional tests
2 nightwatch configurations are present in this repository:
1. local Selenium-based, non-parallel, multi-browser
1. remote browserstack-based, Selenium-based, semi-parallel (BrowserStack provides parallelization), multi-browser

To explore all options see `package.json`. The easiest way to start is with `npm run test:integration:local` (you need Google Chrome for this).

### Executing integration tests from your own machine
1. Copy `.env.example` as `.env`
1. Fill in `BROWSERSTACK_USER` and `BROWSERSTACK_KEY`
1. `npm run test:integration`

### SSL certs
Some of the features, we're testing for, require safe context, which means that `http://localhost` is not sufficient for these features to be enabled, and HTTPS is required. For your convenience dummy self-signed certs are provided out of the box and Selenium is configured to disable SSL verification.

### Local tunnel/proxy
By running BrowserStack-based tests you are exposing your local network to the test runner. Please see `integration-tests/utils/browserstack.runner.js` for more details.

### Safari
Requires the code below to be run once, to enable running integration tests in Safari locally.

```bash
$ /usr/bin/safaridriver --enable
```

## Community Contributions

If you are not a Splunk employee and would like to contribute code to this project, please read and fill out the
[Splunk CLA](https://www.splunk.com/en_us/form/contributions.html).
