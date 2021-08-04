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

const { isBrowser } = require('../../utils/helpers');

/**
 * @param {import('nightwatch').NightwatchBrowser} browser
 * @param {string} filename
 * @param {(clickSpan, childSpan) => void}
 */
async function runTest(browser, filename, extraChecks) {
  await browser.url(browser.globals.getUrl(filename));

  await browser.click('#btn1');
  await browser.globals.waitForTestToFinish();

  const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
  const childSpan = await browser.globals.findSpan(span => span.name === 'context-child');

  browser.assert.not.ok(clickSpan.parentId, 'Click span does not have a parent.');
  console.log(childSpan);
  browser.assert.strictEqual(childSpan.parentId, clickSpan.id, 'Child span belongs to user interaction trace.');

  await browser.globals.assertNoErrorSpans();

  if (extraChecks) {
    await extraChecks(clickSpan, childSpan);
  }
}

module.exports = {
  afterEach: function(browser) {
    browser.globals.clearReceivedSpans();
  },
  setTimeout: async function (browser) {
    await runTest(browser, '/context/set-timeout.ejs');

    browser.globals.clearReceivedSpans();

    await browser.click('#btn2');
    await browser.globals.waitForTestToFinish();

    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    const childSpan = await browser.globals.findSpan(span => span.name === 'context-child');

    browser.assert.ok(!!clickSpan, 'Click has a span');
    browser.assert.not.ok(childSpan.parentId, 'Child span in a longer timeout doesn\'t have a parent');

    await browser.globals.assertNoErrorSpans();
  },
  setImmediate: function (browser) {
    if (!isBrowser(browser, 'ie')) {
      // Only exists in IE
      return Promise.resolve();
    }

    return runTest(browser, '/context/set-immediate.ejs');
  },
  'promise constructor': async function (browser) {
    if (isBrowser(browser, 'ie')) {
      // Doesn't exist natively in IE
      return Promise.resolve();
    }
    await browser.url(browser.globals.getUrl('/context/promise.ejs'));

    for (let i = 1; i <= 5; i++) {
      await browser.click('#btn' + i);
      await browser.globals.waitForTestToFinish();

      const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
      const childSpan = await browser.globals.findSpan(span => span.name === 'context-child');

      browser.assert.not.ok(clickSpan.parentId, `Click ${i} span does not have a parent.`);
      browser.assert.strictEqual(childSpan.parentId, clickSpan.id, `Child span ${i} belongs to user interaction trace.`);

      await browser.globals.assertNoErrorSpans();
      browser.globals.clearReceivedSpans();
    }

    return true;
  },
  'fetch then': function (browser) {
    if (isBrowser(browser, 'ie')) {
      // Doesn't exist natively in IE
      return Promise.resolve();
    }

    return runTest(browser, '/context/fetch-then.ejs');
  },
  'xhr event callback': function (browser) {
    return runTest(browser, '/context/xhr-events.ejs');
  },
  'xhr event with removal': function (browser) {
    return runTest(browser, '/context/xhr-events-removed.ejs');
  },
  'xhr onload property': function (browser) {
    return runTest(browser, '/context/xhr-onload.ejs');
  },
  'mutation observer on textNode': function (browser) {
    return runTest(browser, '/context/mutation-observer-textnode.ejs');
  },
  'MessagePort - addEventListener': function (browser) {
    return runTest(browser, '/context/messageport-addeventlistener.ejs');
  },
  'MessagePort - onmessage': function (browser) {
    return runTest(browser, '/context/messageport-onmessage.ejs');
  },
  'MessagePort: Works with cors': async function (browser) {
    await browser.url(browser.globals.getUrl('/context/messageport-cors.ejs'));
    await browser.globals.waitForTestToFinish();

    await browser.globals.findSpan(span => span.name === 'message-event');

    await browser.globals.assertNoErrorSpans();
  },
  'location - hashchange': async function (browser) {
    await runTest(browser, '/context/location-hash.ejs');

    const clickSpan = await browser.globals.findSpan(span => span.name === 'click');
    const routeChangeSpan = await browser.globals.findSpan(span => span.name === 'routeChange');

    browser.assert.strictEqual(routeChangeSpan.parentId, clickSpan.id, 'Route change span belongs to user interaction trace.');
  },
};
