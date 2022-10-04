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

module.exports = {
  'webvitals spans': async function(browser) {
    // the google webvitals library only works on chrome (and chrome-based edge) at the moment
    if (!browser.globals.isBrowser({ chrome: true, microsoftedge: true })) {
      return;
    }

    const url = browser.globals.getUrl('/webvitals/webvitals.ejs');
    await browser.url(url);
    // fid won't happen unless there is interaction, so simulate a bit of that
    await browser.click('#clicky');
    await browser.waitForElementPresent('#p2');
    // webvitals library won't send the cls unless a visibility change happens, so
    // force a fake one
    await browser.execute(function() {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // force a sync
    await browser.globals.waitForTestToFinish();

    const lcp = await browser.globals.findSpan(span => span.tags.lcp !== undefined);
    const cls = await browser.globals.findSpan(span => span.tags.cls !== undefined);
    const fid = await browser.globals.findSpan(span => span.tags.fid !== undefined);

    await browser.assert.ok(lcp);
    await browser.assert.ok(cls);
      
    await browser.assert.strictEqual(lcp.name, 'webvitals');
    await browser.assert.strictEqual(cls.name, 'webvitals');

    await browser.assert.ok(lcp.tags.lcp > 0);
    await browser.assert.ok(cls.tags.cls >= 0);

    // sometimes missing in automated tests
    if (fid) {
      await browser.assert.strictEqual(fid.name, 'webvitals');
      await browser.assert.ok(fid.tags.fid > 0);
    }

    await browser.globals.assertNoErrorSpans();
  }
};