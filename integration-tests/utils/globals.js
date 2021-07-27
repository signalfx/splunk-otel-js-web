/*
Copyright 2020 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const { isBrowser } = require('./helpers');
const { buildInstrumentationBackend } = require('../../utils/testBackendProvider');

const GLOBAL_TEST_BUFFER_TIMEOUT = 20;
const NETWORK_LATENCY_MARGIN = 2000;

// Allow two buffer timeout cycles to pass, and allow an additional small grace period
const TWO_BUFFER_CYCLES = 2 * GLOBAL_TEST_BUFFER_TIMEOUT;
const SPAN_WAIT_TIMEOUT = TWO_BUFFER_CYCLES + NETWORK_LATENCY_MARGIN;
const SPAN_WAIT_ITERATION_TIME = Math.round(SPAN_WAIT_TIMEOUT / 10);

async function findSpan(spans, testFn, accruedTime) {
  accruedTime = accruedTime || 0;
  if (accruedTime > SPAN_WAIT_TIMEOUT) {
    console.error('Listing recorded spans for your convenience.');
    console.error(spans);
    return null;
  }

  const foundSpan = spans.find(testFn);
  if (foundSpan) {
    return foundSpan;
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(findSpan(spans, testFn, accruedTime + SPAN_WAIT_ITERATION_TIME));
    }, SPAN_WAIT_ITERATION_TIME);
  });
}

async function buildBackendContext(browser) {
  const backend = await browser.globals.buildInstrumentationBackend();

  // Setting longer timeout be cause it seems to take forever for spans to arrive in Safari 10 during tests
  // Real page seems fine. This timeout could be smaller but better safe than flaky for now.
  const defaultTimeout = browser.globals.isBrowser({ 'safari': { max: 10 } }) ? -10000 : 0;

  return {
    httpPort: backend.httpPort,
    clearReceivedSpans:  backend.clearReceivedSpans,
    getReceivedSpans:  backend.getReceivedSpans,
    findSpan:  (testFn, timeout = defaultTimeout) => findSpan(backend.getReceivedSpans(), testFn, timeout),
    wsBase:  backend.getWebsocketsUrl().toString(),
    getLastServerTiming:  backend.getLastServerTiming,
    getUrl:  (...args) => backend.getUrl(...args).toString(),
    _closeBackend: backend.close,
    assertNoErrorSpans: async () => {
      await browser.assert.ok(backend.getReceivedSpans().every(s => s.name !== 'onerror'), 'Ensuring no errors were reported.');
    },

    // left here for old tests
    baseUrl: backend.getUrl().toString(),
    defaultUrl: backend.getUrl('/', ['wsProtocol', 'wsPort']).toString(),
  };
}

module.exports = {
  buildBackendContext,

  // This will be run before each test suite is started
  beforeEach: async (browser, done) => {
    browser.globals.rumVersion = require('../../package.json').version;
    browser.globals.isBrowser = isBrowser.bind(null, browser);

    browser.globals.buildInstrumentationBackend = () => buildInstrumentationBackend({
      enableHttps: browser.globals.enableHttps,
      hostname: browser.globals.hostname,
    });

    Object.assign(browser.globals, await buildBackendContext(browser));

    browser.globals.emulateTabSwitching = async (visible) => {
      await browser.execute((hidden) => {
        Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
        Object.defineProperty(document,'visibilityState', { value: hidden ? 'hidden': 'visible', configurable: true });
        window.dispatchEvent(new Event('visibilitychange'));
      }, [visible]);
    };

    browser.globals.waitForTestToFinish = async () => {
      // eslint-disable-next-line no-shadow
      const { value: lastId } = await browser.executeAsync(function (done) {
        window.waitForTestToFinish(done);
      });

      if (lastId) {
        await browser.globals.findSpan(({ id }) => id === lastId);
      }
    };

    browser.timesMakeSense = async function(eventsArr, startName, endName) {
      const name2time = {};
      eventsArr.forEach(event => {
        name2time[event.value] = event.timestamp;
      });
      await this.assert.ok(name2time[startName], `Checking presence of ${startName}`);
      await this.assert.ok(name2time[endName], `Checking presence of ${endName}`);
      await this.assert.ok(name2time[startName] <= name2time[endName], `Checking sanity of ${startName} vs ${endName}`);
      const diff = name2time[endName] - name2time[startName];
      // times reported in zipkin as micros
      // looking for egregiously incorrect response times here, not a tight bound
      const fiveMinutes = 5 * 60 * 1000 * 1000;
      await this.assert.ok(diff < fiveMinutes, 'Sanity check for time difference.');
      // Also looking for rough synchronization with reality (at least from our CI systems/laptops...)
      const nowMicros = new Date().getTime() * 1000;
      let clockSkew = name2time[startName] - nowMicros;
      if (clockSkew < 0) {
        clockSkew = -clockSkew;
      }
      await this.assert.ok(clockSkew <= fiveMinutes, 'Sanity check for clock skew');
    };

    console.log('Started dev server.');

    // note: at the time this was written util.promisify breaks nightwatch here
    browser.status(() => {
      done();
    });
  },

  // This will be run after each test suite is finished
  afterEach: async function(browser, done) {
    try {
      console.log('Closing dev server.');
      if (browser.globals._closeBackend) {
        await browser.globals._closeBackend();
      }
      console.log('Closed dev server.');
    } finally {
      done();
    }
  },

  GLOBAL_TEST_BUFFER_TIMEOUT,
};
