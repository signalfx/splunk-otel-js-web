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

module.exports = {
  'handles hash navigation': async function(browser) {
    browser.globals.clearReceivedSpans();

    const startUrl = browser.globals.getUrl('/user-interaction/history.ejs');
    await browser.url(startUrl);
    await browser.click('#btnGoToPage');

    const navigationSpan = await browser.globals.findSpan(span => span.name === 'routeChange');
    await browser.assert.ok(!!navigationSpan, 'Checking navigation span presence.');

    await browser.assert.strictEqual(navigationSpan.tags['component'], 'user-interaction');
    if (!isBrowser(browser, 'ie')) {
      await browser.assert.strictEqual(navigationSpan.tags['prev.href'], startUrl);
    }
    await browser.assert.strictEqual(navigationSpan.tags['location.href'], startUrl + '#another-page');

    await browser.globals.assertNoErrorSpans();
  },
  'handles history navigation': async function(browser) {
    browser.globals.clearReceivedSpans();

    const startUrl = browser.globals.getUrl('/user-interaction/history.ejs');
    await browser.url(startUrl);
    await browser.click('#btnGoToPage');
    await browser.globals.findSpan(span => span.name === 'routeChange');

    browser.globals.clearReceivedSpans();
    await browser.click('#btnGoBack');

    const navigationBackSpan = await browser.globals.findSpan(span => span.name === 'routeChange');
    await browser.assert.ok(!!navigationBackSpan, 'Checking backwards navigation span presence.');

    await browser.assert.strictEqual(navigationBackSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(navigationBackSpan.tags['prev.href'], startUrl + '#another-page');
    await browser.assert.strictEqual(navigationBackSpan.tags['location.href'], startUrl);

    browser.globals.clearReceivedSpans();
    await browser.click('#btnGoForward');

    const navigationForwardSpan = await browser.globals.findSpan(span => span.name === 'routeChange');
    await browser.assert.ok(!!navigationForwardSpan, 'Checking forwards navigation span presence.');

    await browser.assert.strictEqual(navigationForwardSpan.tags['component'], 'user-interaction');
    await browser.assert.strictEqual(navigationForwardSpan.tags['prev.href'], startUrl);
    await browser.assert.strictEqual(navigationForwardSpan.tags['location.href'], startUrl + '#another-page');
  },
};
