# Building, testing and contributing to splunk-browser-otel-js
## Building, preamble
This repo makes use of git submodules to pull in the latest otel-js and otel-js-contrib code.  In time, we may move to only using
published versions.  Meanwhile, do not modify anything in the deps/ directory once you've updated the submodules.  We want to make
direct contributions to otel upstream.

```bash
$ git submodule update --init --recursive # one-time
$ git submodule update --recursive # every time you update this repo
```

## Building, for real
Build as so:

```bash
$ git submodule update
$ npm install
$ npm run dist
$ npm run lint (optional)
$ npm test (optional)
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

## Releasing
1. Prepare the release commit on `main`
    1. Update the version in `package.json`
    1. `npm i` to update the version in `package-lock.json`
    1. Update the changelog by creating a section for the new version, and moving all unreleased entries to it
    1. Commit as `chore: prepare release <version>`
1. `git push origin main` to publish
1. `git tag v<version>` - please don't forget the "v"
1. `git push origin v<version>` to publish the version tag, this starts the Github workflow, which will:
    1. create a Github Release
    1. publish to NPM
1. Navigate to <https://github.com/signalfx/rum-browser-js/releases/> and find the release you just created
    1. Update the changelog or link to the right section in README.    
1. run `npm run release:cdn` and verify that the plan is correct
1. run `npm run release:cdn:wet`
    1. this script updates release contents and will ask you to verify them (URL will be provided)
    1. update the versions in `integration-tests/tests/cdn/index.ejs` and `integration-tests/tests/cdn/index.spec.js`
    1. verify that CDN works by running `npm run test:integration:local:chrome`

## Community Contributions

If you are not a Splunk employee and would like to contribute code to this project, please read and fill out the
[Splunk CLA](https://www.splunk.com/en_us/form/contributions.html).
