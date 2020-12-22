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

const specUtils = require('../spec-utils');

module.exports = {
  'XHR request is registered': async function(browser) {
    await browser.url(browser.globals.getUrl('/xhr/views/xhr-basic.ejs'));
    const xhrSpan = await browser.globals.findSpan(span => span.tags['http.url'] === '/some-data');
    await browser.assert.ok(xhrSpan);
    await browser.assert.strictEqual(xhrSpan.tags['component'], 'xml-http-request');
    await browser.assert.strictEqual(xhrSpan.tags['http.status_code'], '200');
    await browser.assert.strictEqual(xhrSpan.tags['http.status_text'], 'OK');
    await browser.assert.strictEqual(xhrSpan.tags['http.method'], 'GET');
    await browser.assert.strictEqual(xhrSpan.tags['http.url'], '/some-data');
    if (browser.options.desiredCapabilities.browserName.toLowerCase() !==  'safari') {
      await browser.assert.strictEqual(xhrSpan.tags['http.response_content_length'], '49');
    }
    await browser.assert.ok(xhrSpan.tags['link.traceId']);
    await browser.assert.ok(xhrSpan.tags['link.spanId']);
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'domainLookupStart', 'domainLookupEnd');
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'connectStart', 'connectEnd');
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'secureConnectionStart', 'connectEnd');
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'requestStart', 'responseStart');
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'responseStart', 'responseEnd');
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'fetchStart', 'responseEnd');
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'open', 'send');
    await specUtils.timesMakeSense(browser, xhrSpan.annotations, 'send', 'loaded');
  },
};
