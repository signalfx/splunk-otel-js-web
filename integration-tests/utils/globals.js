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

const devServer = require('../devServer/devServer');

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
    const spans = [];
    const handleSpanReceived = (spanName) => { spans.push(spanName); };
    browser.globals.receivedSpans = spans;
    browser.globals.rumVersion = require('../../package.json').version;
    browser.globals.clearReceivedSpans = () => { spans.length = 0; };
    browser.globals.findSpan = (testFn, timeout = 0) => findSpan(spans, testFn, timeout);
    browser.globals.emulateTabSwitchingAway = async () => {
      await browser.execute(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };
    // browser.globals.delay = (time) => new Promise(resolve => setTimeout(resolve, time));
    //    browser.globals.spansSoFar = () => spans.slice();

    console.log('Starting dev server (dummy page and traces receiver).');
    browser.globals._backend = await devServer.run({
      onSpanReceived: handleSpanReceived,
      enableHttps: browser.globals.enableHttps,
    });

    const wsProtocol = browser.globals.enableHttps ? 'wss' : 'ws';
    const httpProtocol = browser.globals.enableHttps ? 'https' : 'http';
    const base = `${httpProtocol}://${browser.globals.host}:${browser.globals._backend.port}`;
    browser.globals.wsBase = `${wsProtocol}://${browser.globals.host}:${browser.globals._backend.websocketsPort}/`;
    const AVAILABLE_SEARCH_PARAMS = {
      wsProtocol: wsProtocol,
      wsPort: browser.globals._backend.websocketsPort  
    };

    browser.globals.getUrl = function(path = '', includedParams = Object.keys(AVAILABLE_SEARCH_PARAMS) ) {
      let url = base;
      if (path) {
        url += path;
      }  

      includedParams.forEach( (name, index) => {
        if (index === 0) {
          url += '?';
        }
        url += `&${name}=${AVAILABLE_SEARCH_PARAMS[name]}`;
      });

      return url;
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
    browser.globals.baseUrl = base + '/';
    browser.globals.defaultUrl = `${browser.globals.baseUrl}?wsProtocol=${wsProtocol}&wsPort=${browser.globals._backend.websocketsPort}`;
    console.log('Started dev server.');

    // note: at the time this was written util.promisify breaks nightwatch here
    browser.status(() => {
      done();
    });
  },

  // This will be run after each test suite is finished
  afterEach: async function(browser, done) {
    console.log('Closing dev server.');
    if (browser.globals._backend) {
      await browser.globals._backend.close();
    }
    console.log('Closed dev server.');
    done();
  },

  GLOBAL_TEST_BUFFER_TIMEOUT,
};
