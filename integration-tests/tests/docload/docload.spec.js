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

  'documentFetch, resourceFetch, and documentLoad spans': async function(browser) {
    const url = browser.globals.getUrl('/docload/docload.ejs');
    await browser.url(url);

    const docFetch = await browser.globals.findSpan(span => span.name === 'documentFetch');
    const scriptFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch' && span.tags['http.url'].includes('splunk-rum.js'));
    const docLoad = await browser.globals.findSpan(span => span.name === 'documentLoad');
    const brokenImgFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch' && span.tags['http.url'].includes('/nosuchimage.jpg'));
    
    await browser.assert.ok(docFetch, 'Checking docFetch span');
    await browser.assert.ok(scriptFetch, 'Checking scriptFetch span');
    await browser.assert.ok(docLoad, 'Checking docLoad span');
    await browser.assert.ok(brokenImgFetch, 'Checking brokenImgFetch span');

    await browser.assert.ok(docLoad.traceId.match(/[a-f0-9]+/), 'Checking sanity of traceId');
    await browser.assert.ok(docLoad.id.match(/[a-f0-9]+/), 'Checking sanity of id');
    await browser.assert.strictEqual(docFetch.traceId, docLoad.traceId);
    await browser.assert.strictEqual(docFetch.parentId, docLoad.id);

    // FIXME otel is broken at the moment - need to fix up their code that makes this all the same trace
    // await browser.assert.strictEqual(scriptFetch.traceId, docLoad.traceId);
    // await browser.assert.strictEqual(scriptFetch.parentId, docLoad.id);
    // await browser.assert.strictEqual(brokenImgFetch.traceId, docLoad.traceId);
    // await browser.assert.strictEqual(brokenImgFetch.parentId, docLoad.id);

    // docFetch
    await browser.assert.strictEqual(docFetch.tags['component'], 'document-load');
    await browser.assert.strictEqual(docFetch.tags['location.href'], url);
    await specUtils.timesMakeSense(browser, docFetch.annotations, 'domainLookupStart', 'domainLookupEnd');
    await specUtils.timesMakeSense(browser, docFetch.annotations, 'connectStart', 'connectEnd');
    await specUtils.timesMakeSense(browser, docFetch.annotations, 'requestStart', 'responseStart');
    await specUtils.timesMakeSense(browser, docFetch.annotations, 'responseStart', 'responseEnd');
    await specUtils.timesMakeSense(browser, docFetch.annotations, 'fetchStart', 'responseEnd');
    if (browser.options.desiredCapabilities.browserName !== 'Safari') {
      await browser.assert.ok(docFetch.tags['http.response_content_length'] >= 0, 'Checking response_content_length');
      await browser.assert.ok(docFetch.tags['link.traceId'], 'Checking presence of link.traceId');
      await browser.assert.ok(docFetch.tags['link.spanId'], 'Checking presence of link.spanId');
    }

    // scriptFetch
    await browser.assert.strictEqual(scriptFetch.tags['component'], 'document-load');
    await browser.assert.strictEqual(scriptFetch.tags['location.href'], url);
    if (browser.options.desiredCapabilities.browserName !== 'Safari') {
      await browser.assert.ok(scriptFetch.tags['http.response_content_length'] >= 0, 'Checking response_content_length');
      await browser.assert.ok(docFetch.tags['link.traceId'], 'Checking presence of link.traceId');
      await browser.assert.ok(docFetch.tags['link.spanId'], 'Checking presence of link.spanId');
    }
    // http.url has already been checked by the findSpan
    
    // documentLoad
    await browser.assert.strictEqual(docLoad.tags['component'], 'document-load');
    await browser.assert.strictEqual(docLoad.tags['location.href'], url);
    await browser.assert.ok(docLoad.tags['screen.xy'].match(/[0-9]+x[0-9]+/), 'Checking sanity of screen.xy');
    await specUtils.timesMakeSense(browser, docLoad.annotations, 'domContentLoadedEventStart', 'domContentLoadedEventEnd');
    await specUtils.timesMakeSense(browser, docLoad.annotations, 'loadEventStart', 'loadEventEnd');
    await specUtils.timesMakeSense(browser, docLoad.annotations, 'fetchStart', 'domInteractive');
    await specUtils.timesMakeSense(browser, docLoad.annotations, 'fetchStart', 'domComplete');
  }
};