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
  '@tags': ['safari-10.1'],
  'documentFetch, resourceFetch, and documentLoad spans': async function(browser) {
    const {browserName, browser_version} = browser.options.desiredCapabilities;
    const url = browser.globals.getUrl('/docload/docload.ejs');
    await browser.url(url);

    const docFetch = await browser.globals.findSpan(span => span.name === 'documentFetch');
    const docLoad = await browser.globals.findSpan(span => span.name === 'documentLoad');
    const scriptFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch' && span.tags['http.url'].includes('splunk-rum.js'));
    const brokenImgFetch = await browser.globals.findSpan(span => span.name === 'resourceFetch' && span.tags['http.url'].includes('/nosuchimage.jpg'));

    await browser.assert.ok(docFetch, 'Checking docFetch span');
    await browser.assert.ok(docLoad, 'Checking docLoad span');
    await browser.assert.ok(docLoad.traceId.match(/[a-f0-9]+/), 'Checking sanity of traceId');
    await browser.assert.ok(docLoad.id.match(/[a-f0-9]+/), 'Checking sanity of id');
    await browser.assert.strictEqual(docFetch.traceId, docLoad.traceId);
    await browser.assert.strictEqual(docFetch.parentId, docLoad.id);

    if (!(browserName === 'Safari' && browser_version === '10.1')) {
      await browser.assert.ok(scriptFetch, 'Checking scriptFetch span');
      await browser.assert.strictEqual(scriptFetch.traceId, docLoad.traceId);
      await browser.assert.strictEqual(scriptFetch.parentId, docLoad.id);
      await browser.assert.strictEqual(scriptFetch.tags['component'], 'document-load');
      await browser.assert.strictEqual(scriptFetch.tags['location.href'], url);

      await browser.assert.ok(brokenImgFetch, 'Checking brokenImgFetch span');
      await browser.assert.strictEqual(brokenImgFetch.traceId, docLoad.traceId);
      await browser.assert.strictEqual(brokenImgFetch.parentId, docLoad.id);
    }
    // docFetch
    await browser.assert.strictEqual(docFetch.tags['component'], 'document-load');
    await browser.assert.strictEqual(docFetch.tags['location.href'], url);
    await browser.timesMakeSense(docFetch.annotations, 'domainLookupStart', 'domainLookupEnd');
    await browser.timesMakeSense(docFetch.annotations, 'connectStart', 'connectEnd');
    await browser.timesMakeSense(docFetch.annotations, 'requestStart', 'responseStart');
    await browser.timesMakeSense(docFetch.annotations, 'responseStart', 'responseEnd');
    await browser.timesMakeSense(docFetch.annotations, 'fetchStart', 'responseEnd');
    if (browserName !== 'Safari') {
      await browser.assert.ok(docFetch.tags['http.response_content_length'] >= 0, 'Checking response_content_length');
      await browser.assert.ok(docFetch.tags['link.traceId'], 'Checking presence of link.traceId');
      await browser.assert.ok(docFetch.tags['link.spanId'], 'Checking presence of link.spanId');
    }

    // scriptFetch
    if (browserName !== 'Safari') {
      await browser.assert.ok(scriptFetch.tags['http.response_content_length'] >= 0, 'Checking response_content_length');
      await browser.assert.ok(docFetch.tags['link.traceId'], 'Checking presence of link.traceId');
      await browser.assert.ok(docFetch.tags['link.spanId'], 'Checking presence of link.spanId');
    }
    // http.url has already been checked by the findSpan
    
    // documentLoad
    await browser.assert.strictEqual(docLoad.tags['component'], 'document-load');
    await browser.assert.strictEqual(docLoad.tags['location.href'], url);
    await browser.assert.ok(docLoad.tags['screen.xy'].match(/[0-9]+x[0-9]+/), 'Checking sanity of screen.xy');
    await browser.timesMakeSense(docLoad.annotations, 'domContentLoadedEventStart', 'domContentLoadedEventEnd');
    await browser.timesMakeSense(docLoad.annotations, 'loadEventStart', 'loadEventEnd');
    await browser.timesMakeSense(docLoad.annotations, 'fetchStart', 'domInteractive');
    await browser.timesMakeSense(docLoad.annotations, 'fetchStart', 'domComplete');
  }
};