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

// Batch millis is currently 5000, so allow two cycles (in case the span happened
// just as the last one was sent), plus a small grace period -> 11 seconds
const SPAN_WAIT_TIMEOUT = 11 * 1000;
const SPAN_WAIT_ITERATION_TIME = 1000;

async function findSpan(spans, testFn, accruedTime) {
  accruedTime = accruedTime || 0;
  if (accruedTime > SPAN_WAIT_TIMEOUT) {
    console.error('Listing recorded spans for your convenience.');
    console.error(spans);
    return false;
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
    browser.globals.findSpan = (testFn) => findSpan(spans, testFn);

    console.log('Starting dev server (dummy page and traces receiver).');
    browser.globals._backend = await devServer.run({
      onSpanReceived: handleSpanReceived,
      enableHttps: browser.globals.enableHttps,
    });

    const wsProtocol = browser.globals.enableHttps ? 'wss' : 'ws';
    const base = `${browser.globals.host}:${browser.globals._backend.port}`;
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
  }
};
