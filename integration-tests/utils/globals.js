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

const { buildIntegrationBackend } = require('./testBackendProvider');

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

module.exports = {
  // This will be run before each test suite is started
  beforeEach: async (browser, done) => {
    browser.globals.rumVersion = require('../../package.json').version;
    let defaultTimeout = 0;
    browser.globals.isBrowser = function(name, version) {
      const browserName =  browser.options.desiredCapabilities.browserName.toLowerCase();
      const browser_version =  browser.options.desiredCapabilities.browser_version;

      let versionMatch = true;
      if (version !== undefined) {
        versionMatch = browser_version === version;
      }
      return browserName === name.toLowerCase() && versionMatch;
    };
    
    if (browser.globals.isBrowser('safari', '10.1')) {
      // Setting longer timeout be cause it seems to take forever for spans to arrive in Safari 10 during tests
      // Real page seems fine. This timeout could be smaller but better safe than flaky for now.
      defaultTimeout = -10000;
    }
    
    const backend = await buildIntegrationBackend({
      enableHttps: browser.globals.enableHttps,
    });
    browser.globals._closeBackend = backend.close;
    browser.globals.buildIntegrationBackend = () => buildIntegrationBackend({
      enableHttps: browser.globals.enableHttps,
    });

    browser.globals.httpPort = backend.httpPort;
    browser.globals.clearReceivedSpans = backend.clearReceivedSpans;
    browser.globals.getReceivedSpans = backend.getReceivedSpans;
    browser.globals.findSpan = (testFn, timeout = defaultTimeout) => findSpan(backend.getReceivedSpans(), testFn, timeout);
    browser.globals.wsBase = backend.getWebsocketsUrl().toString();
    browser.globals.getLastServerTiming = backend.getLastServerTiming;
    browser.globals.getUrl = (...args) => backend.getUrl(...args).toString();

    browser.globals.emulateTabSwitchingAway = async () => {
      await browser.execute(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };

    browser.globals.assertNoErrorSpans = async () => { 
      await browser.assert.ok(backend.getReceivedSpans().every(s => s.name !== 'onerror'), 'Ensuring no errors were reported.');
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
  
    // left here for old tests
    browser.globals.baseUrl = backend.getUrl().toString();
    browser.globals.defaultUrl = backend.getUrl('/', ['wsProtocol', 'wsPort']).toString();
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
