## Building, preamble
This repo makes use of git submodules to pull in the latest otel-js and otel-js-contrib code.  In time, we may move to only using
published versions.  Meanwhile, do not modify anything in the deps/ directory once you've updated the submodules.  We want to make
direct contributions to otel upstream.

```
$ git submodule init   (one-time)
$ git submodule update  (every time you update this repo)
```

## Building, for real
Build as so:

```
$ git submodule update
$ npm install
$ npm run lint (optional)
$ npm test (optional)
$ npx rollup -c (this produces dist/splunk-rum.js)
$ DEBUG_BUILD=1 npx rollup -c (optional; this produces dist/splunk-rum.debug.js)
$ npx eslint --no-eslintrc --env es2015 dist/splunk-rum.js (pure syntax check of dist script; optional)
```
For your convenience, the script `fullbuild.sh` runs all these steps except for the submodule update.

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

## Updating deps from upstream

Periodically this repo needs to pull in the latest from upstream (otel-js and otel-js-contrib).  I recommend doing one at a time
and testing in between to isolate things that affect us more directly.

```
$ cd deps/
$ git submodule status (review output, note the commit hash of each upstream HEAD, compare to actual remote HEAD)
$ git submodule update --remote opentelemetry-js (or -contrib)
(run tests, automated and manual sanity; adjust our code as necessary).
$ git diff
(You should see a diff showing the commit hashes changing for the submodules)
```

From here, you can commit+push like normal.

## Releasing (During alpha/beta/preview)

1. `git checkout main && git pull`, generally clean up the workspace.
1. Run build + tests:
    ```
    $ git submodule update
    $ ./fullbuild.sh
    ```
1. Manual sanity test
1. `npm version patch`
1. `git push` to publish the version bump commit
1. `git push origin --tags` to publish the version tag, if you haven't created any local tags manually
1. `git push origin <release tag>` if you have local tags, which shouldn't be published
1. Release on github: https://github.com/signalfx/rum-browser-js/releases/
    1. "Draft a new release"
    1. Fill out the tag version.  This is confusing as github has automatically created a 
       release from the tag.  Doing this and publishing will change/overwrite the automatically
       generated one.
    1. Fill out release title, release notes
    1. Attach splunk-rum.js
    1. "Publish" the release.

## Community Contributions

If you are not a Splunk employee and would like to contribute code to this project, please read and fill out the
[Splunk CLA](https://www.splunk.com/en_us/form/contributions.html).

